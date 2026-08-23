import { ERROR_CODES, RangeParseError } from "./errors.js";

const MAX_EXCEL_ROW = 1_048_576;
const MAX_EXCEL_COLUMN = 16_384;

export interface ParsedRange {
  readonly startRow: number;
  readonly startColumn: number;
  readonly endRow: number;
  readonly endColumn: number;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly cellCount: number;
  readonly normalized: string;
}

function columnNameToNumber(column: string): number {
  let value = 0;
  for (const character of column) {
    value = value * 26 + character.charCodeAt(0) - 64;
  }
  return value;
}

export function parseColumnName(column: string): number {
  if (!/^[A-Z]{1,3}$/.test(column)) {
    throw new RangeParseError(ERROR_CODES.invalid_range, `Unsupported column name: ${column}`);
  }
  const value = columnNameToNumber(column);
  if (value < 1 || value > MAX_EXCEL_COLUMN) {
    throw new RangeParseError(
      ERROR_CODES.range_bounds_exceeded,
      `Column exceeds Excel-compatible bounds: ${column}`,
    );
  }
  return value;
}

export function columnNumberToName(column: number): string {
  if (!Number.isInteger(column) || column < 1 || column > MAX_EXCEL_COLUMN) {
    throw new RangeError(`Column must be an integer from 1 to ${MAX_EXCEL_COLUMN}.`);
  }

  let remaining = column;
  let result = "";
  while (remaining > 0) {
    const index = (remaining - 1) % 26;
    result = String.fromCharCode(65 + index) + result;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return result;
}

export function parseA1Range(input: string): ParsedRange {
  const normalizedInput = input.trim().toUpperCase();
  const match = /^([A-Z]{1,3})([1-9][0-9]*)(?::([A-Z]{1,3})([1-9][0-9]*))?$/.exec(
    normalizedInput,
  );

  if (!match) {
    throw new RangeParseError(ERROR_CODES.invalid_range, `Unsupported A1 range: ${input}`);
  }

  const startColumnName = match[1];
  const startRowText = match[2];
  if (!startColumnName || !startRowText) {
    throw new RangeParseError(ERROR_CODES.invalid_range, `Unsupported A1 range: ${input}`);
  }

  const endColumnName = match[3] ?? startColumnName;
  const endRowText = match[4] ?? startRowText;
  const startColumn = columnNameToNumber(startColumnName);
  const endColumn = columnNameToNumber(endColumnName);
  const startRow = Number(startRowText);
  const endRow = Number(endRowText);

  if (
    startColumn > MAX_EXCEL_COLUMN ||
    endColumn > MAX_EXCEL_COLUMN ||
    startRow > MAX_EXCEL_ROW ||
    endRow > MAX_EXCEL_ROW
  ) {
    throw new RangeParseError(
      ERROR_CODES.range_bounds_exceeded,
      `Range exceeds Excel-compatible bounds: ${input}`,
    );
  }

  if (endColumn < startColumn || endRow < startRow) {
    throw new RangeParseError(
      ERROR_CODES.range_reversed,
      `Range must run from top-left to bottom-right: ${input}`,
    );
  }

  const rowCount = endRow - startRow + 1;
  const columnCount = endColumn - startColumn + 1;
  const normalized = `${columnNumberToName(startColumn)}${startRow}:${columnNumberToName(endColumn)}${endRow}`;

  return {
    startRow,
    startColumn,
    endRow,
    endColumn,
    rowCount,
    columnCount,
    cellCount: rowCount * columnCount,
    normalized,
  };
}
