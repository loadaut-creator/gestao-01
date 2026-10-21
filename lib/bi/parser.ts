import { unzipSync, strFromU8 } from "fflate";

export type ParsedTable = { columns: string[]; rows: string[][]; sheetName?: string };
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_ROWS = 20000;

function delimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(value.trim()); value = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(value.trim()); value = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      if (rows.length > MAX_ROWS + 1) throw new Error("O arquivo excede o limite de 20.000 linhas.");
    } else value += char;
  }
  if (quoted) throw new Error("O CSV contém aspas sem fechamento.");
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function detectDelimiter(text: string) {
  const sample = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = ["\t", ";", ","];
  return candidates.map((delimiter) => ({ delimiter, count: delimited(sample, delimiter)[0]?.length ?? 0 }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function parseXml(value: Uint8Array) {
  const xml = new DOMParser().parseFromString(strFromU8(value), "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("A planilha contém XML inválido.");
  return xml;
}

function childText(node: Element, tag: string) {
  return Array.from(node.getElementsByTagName("*")).filter((element) => element.localName === tag)
    .map((element) => element.textContent ?? "").join("");
}

function columnIndex(ref: string) {
  const letters = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "";
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

function parseXlsx(buffer: ArrayBuffer): { matrix: string[][]; sheetName?: string } {
  let expandedBytes = 0;
  const zip = unzipSync(new Uint8Array(buffer), { filter: (entry) => {
    const needed = entry.name === "xl/workbook.xml" || entry.name === "xl/_rels/workbook.xml.rels" || entry.name === "xl/sharedStrings.xml" || /^xl\/worksheets\/[^/]+\.xml$/.test(entry.name);
    if (!needed) return false;
    expandedBytes += entry.originalSize;
    if (expandedBytes > 60 * 1024 * 1024) throw new Error("A planilha é grande demais para leitura neste navegador.");
    return true;
  } });
  const workbookBytes = zip["xl/workbook.xml"];
  const relsBytes = zip["xl/_rels/workbook.xml.rels"];
  if (!workbookBytes || !relsBytes) throw new Error("A estrutura do arquivo .xlsx está incompleta.");
  const workbook = parseXml(workbookBytes);
  const firstSheet = Array.from(workbook.getElementsByTagName("*")).find((node) => node.localName === "sheet");
  if (!firstSheet) throw new Error("A planilha não contém abas.");
  const relationId = firstSheet.getAttribute("r:id") || firstSheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const rels = parseXml(relsBytes);
  const relation = Array.from(rels.getElementsByTagName("*")).find((node) => node.localName === "Relationship" && node.getAttribute("Id") === relationId);
  if (!relation) throw new Error("Não foi possível localizar a primeira aba da planilha.");
  const target = relation.getAttribute("Target") ?? "";
  const normalizedPath = target.startsWith("/") ? target.slice(1) : "xl/" + target;
  const pathParts: string[] = [];
  for (const part of normalizedPath.split("/")) {
    if (part === "..") pathParts.pop();
    else if (part && part !== ".") pathParts.push(part);
  }
  const path = pathParts.join("/");
  const sheetBytes = zip[path];
  if (!sheetBytes) throw new Error("Não foi possível ler a primeira aba da planilha.");
  const sharedXml = zip["xl/sharedStrings.xml"] ? parseXml(zip["xl/sharedStrings.xml"]) : null;
  const shared = sharedXml ? Array.from(sharedXml.getElementsByTagName("*")).filter((node) => node.localName === "si").map((node) => childText(node, "t")) : [];
  const sheet = parseXml(sheetBytes);
  const rows = Array.from(sheet.getElementsByTagName("*")).filter((node) => node.localName === "row");
  if (rows.length > MAX_ROWS + 1) throw new Error("O arquivo excede o limite de 20.000 linhas.");
  const matrix = rows.map((row) => {
    const cells: string[] = [];
    let nextIndex = 0;
    for (const cell of Array.from(row.children).filter((node) => node.localName === "c")) {
      const reference = cell.getAttribute("r");
      const index = reference ? columnIndex(reference) : nextIndex;
      nextIndex = index + 1;
      if (index < 0 || index > 250) continue;
      const type = cell.getAttribute("t");
      const value = type === "inlineStr" ? childText(cell, "t") : childText(cell, "v");
      cells[index] = type === "s" ? shared[Number(value)] ?? "" : value;
    }
    return Array.from({ length: cells.length }, (_, index) => cells[index] ?? "");
  }).filter((row) => row.some((value) => value.trim()));
  return { matrix, sheetName: firstSheet.getAttribute("name") ?? undefined };
}

export async function parseBiFile(file: File): Promise<ParsedTable> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "csv" && extension !== "xlsx") throw new Error("Selecione um arquivo .csv ou .xlsx.");
  if (file.size > MAX_FILE_BYTES) throw new Error("O arquivo excede o limite de 15 MB.");
  let matrix: string[][], sheetName: string | undefined;
  if (extension === "xlsx") ({ matrix, sheetName } = parseXlsx(await file.arrayBuffer()));
  else {
    const text = await file.text();
    matrix = delimited(text.replace(/^\uFEFF/, ""), detectDelimiter(text));
  }
  if (matrix.length < 2) throw new Error("O arquivo precisa ter cabeçalho e pelo menos uma linha de dados.");
  const columns = matrix[0].map((column, index) => column.trim() || `Coluna ${index + 1}`);
  if (new Set(columns.map((column) => column.toLocaleLowerCase("pt-BR"))).size !== columns.length) {
    throw new Error("O arquivo contém colunas com nomes repetidos.");
  }
  return { columns, rows: matrix.slice(1).map((row) => columns.map((_, index) => row[index] ?? "")), sheetName };
}
