"""Read-only check of a Power BI 'Dados com layout atual' XLSX export."""
import argparse
import datetime
import json
import re
import zipfile
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument("file")
parser.add_argument("--date", required=True, help="Expected day, YYYY-MM-DD")
args = parser.parse_args()
expected = datetime.date.fromisoformat(args.date)
ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

with zipfile.ZipFile(args.file) as archive:
    strings = []
    if "xl/sharedStrings.xml" in archive.namelist():
        strings = ["".join(item.itertext()) for item in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("s:si", ns)]
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    sheet = workbook.find("s:sheets/s:sheet", ns)
    rid = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
    relationship = next(item for item in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels")) if item.attrib["Id"] == rid)
    target = relationship.attrib["Target"]
    target = target.lstrip("/") if target.startswith("/") else "xl/" + target
    matrix = []
    for row in ET.fromstring(archive.read(target)).findall(".//s:sheetData/s:row", ns):
        cells = []
        for position, cell in enumerate(row.findall("s:c", ns)):
            index = position
            if cell.attrib.get("r"):
                column = 0
                for letter in re.match(r"[A-Za-z]+", cell.attrib["r"])[0].upper():
                    column = column * 26 + ord(letter) - 64
                index = column - 1
            while len(cells) <= index:
                cells.append("")
            value = cell.findtext("s:v", "", ns)
            if cell.attrib.get("t") == "s":
                value = strings[int(value)]
            elif cell.attrib.get("t") == "inlineStr":
                value = "".join(cell.find("s:is", ns).itertext())
            cells[index] = value
        if any(value.strip() for value in cells):
            matrix.append(cells)

columns = [value.strip() for value in matrix[0]] if matrix else []
if "Vendedor" not in columns or "Venda" not in columns:
    raise SystemExit("Cabeçalho incompatível: exporte Dados com layout atual, com Vendedor e Venda.")
seller_index, sale_index = columns.index("Vendedor"), columns.index("Venda")
excluded, positives, blanks, total, invalid = [], 0, 0, 0.0, []
filter_notes = []
for index, row in enumerate(matrix[1:], start=2):
    seller = row[seller_index].strip() if len(row) > seller_index else ""
    if seller.casefold() in ("total", "total geral") or seller.casefold().startswith("filtros aplicados:"):
        excluded.append(index)
        if seller.casefold().startswith("filtros aplicados:"):
            filter_notes.append(seller)
        continue
    value = row[sale_index].strip() if len(row) > sale_index else ""
    if not seller:
        invalid.append(index)
        continue
    if not value or value.casefold() == "(em branco)":
        blanks += 1
        continue
    try:
        # Excel numeric cells use a dot decimal separator, without locale grouping.
        number = float(value.replace(".", "").replace(",", ".") if "," in value else value)
    except ValueError:
        invalid.append(index)
        continue
    if number > 0:
        positives += 1
    total += number

dates = [datetime.datetime.strptime(value, "%d/%m/%Y").date() for note in filter_notes for value in re.findall(r"\b\d{2}/\d{2}/\d{4}\b", note)]
# Power BI's end filter is exclusive: >= selected day AND < following day.
date_matches = len(dates) == 2 and dates[0] == expected and dates[1] == expected + datetime.timedelta(days=1)
result = {
    "date": args.date,
    "dateMatches": date_matches,
    "columns": len(columns),
    "rows": len(matrix) - 1,
    "positiveRows": positives,
    "blankSaleRows": blanks,
    "invalidSourceRows": invalid,
    "excludeSourceRows": excluded,
    "totalWithoutSummaryRows": round(total, 2),
    "ready": date_matches and positives > 0 and not invalid,
}
print(json.dumps(result))
