/**
 * CSV encoding for the admin donations export. Pure module.
 * - every cell is quoted and `"` is doubled;
 * - cells starting with = + - @ TAB or CR get a leading `'` so spreadsheet
 *   apps never evaluate them as formulas (OWASP CSV injection guidance);
 * - CRLF line endings and a UTF-8 BOM so Excel opens it correctly.
 */
export type CsvValue = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export const CSV_BOM = "\uFEFF";

export function toCsv(rows: CsvValue[][]): string {
  return (
    CSV_BOM +
    rows.map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
