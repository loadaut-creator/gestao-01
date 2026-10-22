// Numeric XLSX cells use a decimal point regardless of the user's locale.
// Keep text cells untouched; only the XML numeric-cell reader uses this helper.
export function excelNumericText(value: string): string {
  return value.replace(".", ",");
}
