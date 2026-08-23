import { digestJson } from "./canonical.js";
import { columnNumberToName, parseA1Range } from "./range.js";
import type { CellFormat, CellValue, ValidationRule } from "./types.js";

export type SnapshotSourceCell =
  | { readonly kind: "value"; readonly value: CellValue }
  | { readonly kind: "formula"; readonly formula: string };

export interface SnapshotSourceSheet {
  readonly cells: Readonly<Record<string, SnapshotSourceCell>>;
  readonly validations: Readonly<Record<string, ValidationRule>>;
  readonly formats: Readonly<Record<string, CellFormat>>;
  readonly frozen: { readonly rows: number; readonly columns: number };
  readonly columnWidths: Readonly<Record<string, number>>;
}

export interface SnapshotSourceWorkbook {
  readonly id: string;
  readonly sheets: Readonly<Record<string, SnapshotSourceSheet>>;
}

export type SnapshotCell =
  | { readonly address: string; readonly kind: "value"; readonly value: CellValue }
  | { readonly address: string; readonly kind: "formula"; readonly formula: string };

export interface SnapshotValidation {
  readonly range: string;
  readonly rule: ValidationRule;
}

export interface SnapshotFormat {
  readonly range: string;
  readonly format: CellFormat;
}

export interface SnapshotColumnWidth {
  readonly column: string;
  readonly width: number;
}

export interface SnapshotSheet {
  readonly name: string;
  readonly cells: readonly SnapshotCell[];
  readonly validations: readonly SnapshotValidation[];
  readonly formats: readonly SnapshotFormat[];
  readonly frozen: { readonly rows: number; readonly columns: number };
  readonly columnWidths: readonly SnapshotColumnWidth[];
}

export interface WorkbookSnapshot {
  readonly schemaVersion: "opensheet.snapshot.v1";
  readonly workbookId: string;
  readonly sheets: readonly SnapshotSheet[];
}

export interface CellRef {
  readonly sheet: string;
  readonly address: string;
}

export interface RangeRef {
  readonly sheet: string;
  readonly range: string;
}

export interface ColumnRef {
  readonly sheet: string;
  readonly column: string;
}

export interface SemanticDiff {
  readonly sheets: {
    readonly added: readonly string[];
    readonly removed: readonly string[];
    readonly changed: readonly string[];
  };
  readonly cells: {
    readonly added: readonly CellRef[];
    readonly removed: readonly CellRef[];
    readonly changed: readonly CellRef[];
  };
  readonly validations: {
    readonly added: readonly RangeRef[];
    readonly removed: readonly RangeRef[];
    readonly changed: readonly RangeRef[];
  };
  readonly formats: {
    readonly added: readonly RangeRef[];
    readonly removed: readonly RangeRef[];
    readonly changed: readonly RangeRef[];
  };
  readonly frozen: {
    readonly changed: readonly string[];
  };
  readonly columnWidths: {
    readonly added: readonly ColumnRef[];
    readonly removed: readonly ColumnRef[];
    readonly changed: readonly ColumnRef[];
  };
}

function compareAddresses(left: string, right: string): number {
  const leftRange = parseA1Range(left);
  const rightRange = parseA1Range(right);
  return leftRange.startColumn - rightRange.startColumn || leftRange.startRow - rightRange.startRow;
}

function compareColumns(left: string, right: string): number {
  return parseA1Range(`${left}1`).startColumn - parseA1Range(`${right}1`).startColumn;
}

function snapshotCells(cells: Readonly<Record<string, SnapshotSourceCell>>): SnapshotCell[] {
  return Object.entries(cells)
    .map(([address, cell]) =>
      cell.kind === "formula"
        ? { address, kind: "formula" as const, formula: cell.formula }
        : { address, kind: "value" as const, value: cell.value },
    )
    .sort((left, right) => compareAddresses(left.address, right.address));
}

function snapshotValidations(
  validations: Readonly<Record<string, ValidationRule>>,
): SnapshotValidation[] {
  return Object.entries(validations)
    .map(([range, rule]) => ({ range: parseA1Range(range).normalized, rule }))
    .sort((left, right) => (left.range < right.range ? -1 : left.range > right.range ? 1 : 0));
}

function snapshotFormats(formats: Readonly<Record<string, CellFormat>>): SnapshotFormat[] {
  return Object.entries(formats)
    .map(([range, format]) => ({ range: parseA1Range(range).normalized, format }))
    .sort((left, right) => (left.range < right.range ? -1 : left.range > right.range ? 1 : 0));
}

function snapshotWidths(widths: Readonly<Record<string, number>>): SnapshotColumnWidth[] {
  return Object.entries(widths)
    .map(([column, width]) => ({ column, width }))
    .sort((left, right) => compareColumns(left.column, right.column));
}

export function snapshotMemoryWorkbook(workbook: SnapshotSourceWorkbook): WorkbookSnapshot {
  const sheets = Object.keys(workbook.sheets)
    .sort()
    .map((name) => {
      const sheet = workbook.sheets[name];
      if (!sheet) {
        throw new Error(`Missing sheet '${name}' while creating a snapshot.`);
      }
      return {
        name,
        cells: snapshotCells(sheet.cells),
        validations: snapshotValidations(sheet.validations),
        formats: snapshotFormats(sheet.formats),
        frozen: { rows: sheet.frozen.rows, columns: sheet.frozen.columns },
        columnWidths: snapshotWidths(sheet.columnWidths),
      };
    });

  return {
    schemaVersion: "opensheet.snapshot.v1",
    workbookId: workbook.id,
    sheets,
  };
}

export function digestSnapshot(snapshot: WorkbookSnapshot): string {
  return digestJson(snapshot);
}

function cellsInRange(range: string): string[] {
  const parsed = parseA1Range(range);
  const addresses: string[] = [];
  for (let row = parsed.startRow; row <= parsed.endRow; row += 1) {
    for (let column = parsed.startColumn; column <= parsed.endColumn; column += 1) {
      addresses.push(`${columnNumberToName(column)}${row}`);
    }
  }
  return addresses;
}

export function explodeSnapshot(snapshot: WorkbookSnapshot): WorkbookSnapshot {
  return {
    schemaVersion: snapshot.schemaVersion,
    workbookId: snapshot.workbookId,
    sheets: snapshot.sheets.map((sheet) => {
      const formatsByAddress = new Map<string, SnapshotFormat["format"]>();
      sheet.formats.forEach((entry) => {
        cellsInRange(entry.range).forEach((address) => formatsByAddress.set(address, entry.format));
      });
      const validationsByAddress = new Map<string, SnapshotValidation["rule"]>();
      sheet.validations.forEach((entry) => {
        cellsInRange(entry.range).forEach((address) => validationsByAddress.set(address, entry.rule));
      });
      return {
        name: sheet.name,
        cells: sheet.cells,
        validations: [...validationsByAddress.entries()]
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([range, rule]) => ({ range: parseA1Range(range).normalized, rule })),
        formats: [...formatsByAddress.entries()]
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([range, format]) => ({ range: parseA1Range(range).normalized, format })),
        frozen: sheet.frozen,
        columnWidths: sheet.columnWidths,
      };
    }),
  };
}

function sheetMap(snapshot: WorkbookSnapshot): Map<string, SnapshotSheet> {
  return new Map(snapshot.sheets.map((sheet) => [sheet.name, sheet]));
}

function cellKey(cell: SnapshotCell): string {
  return cell.address;
}

function cellPayload(cell: SnapshotCell): string {
  return digestJson(cell);
}

function keyedDiff<T>(
  before: readonly T[],
  after: readonly T[],
  keyOf: (item: T) => string,
  payloadOf: (item: T) => string,
): { added: T[]; removed: T[]; changed: T[] } {
  const beforeMap = new Map(before.map((item) => [keyOf(item), item]));
  const afterMap = new Map(after.map((item) => [keyOf(item), item]));
  const added: T[] = [];
  const removed: T[] = [];
  const changed: T[] = [];

  for (const [key, item] of afterMap) {
    const previous = beforeMap.get(key);
    if (previous === undefined) {
      added.push(item);
    } else if (payloadOf(previous) !== payloadOf(item)) {
      changed.push(item);
    }
  }
  for (const [key, item] of beforeMap) {
    if (!afterMap.has(key)) {
      removed.push(item);
    }
  }

  return { added, removed, changed };
}

export function diffSnapshots(before: WorkbookSnapshot, after: WorkbookSnapshot): SemanticDiff {
  const beforeSheets = sheetMap(before);
  const afterSheets = sheetMap(after);
  const addedSheets = after.sheets.map((sheet) => sheet.name).filter((name) => !beforeSheets.has(name));
  const removedSheets = before.sheets
    .map((sheet) => sheet.name)
    .filter((name) => !afterSheets.has(name));
  const sharedNames = after.sheets
    .map((sheet) => sheet.name)
    .filter((name) => beforeSheets.has(name));

  const addedCells: CellRef[] = [];
  const removedCells: CellRef[] = [];
  const changedCells: CellRef[] = [];
  const addedValidations: RangeRef[] = [];
  const removedValidations: RangeRef[] = [];
  const changedValidations: RangeRef[] = [];
  const addedFormats: RangeRef[] = [];
  const removedFormats: RangeRef[] = [];
  const changedFormats: RangeRef[] = [];
  const changedFrozen: string[] = [];
  const addedWidths: ColumnRef[] = [];
  const removedWidths: ColumnRef[] = [];
  const changedWidths: ColumnRef[] = [];
  const changedSheets: string[] = [];

  for (const name of addedSheets) {
    const sheet = afterSheets.get(name);
    if (!sheet) {
      continue;
    }
    addedCells.push(...sheet.cells.map((cell) => ({ sheet: name, address: cell.address })));
    addedValidations.push(...sheet.validations.map((entry) => ({ sheet: name, range: entry.range })));
    addedFormats.push(...sheet.formats.map((entry) => ({ sheet: name, range: entry.range })));
    addedWidths.push(...sheet.columnWidths.map((entry) => ({ sheet: name, column: entry.column })));
  }

  for (const name of removedSheets) {
    const sheet = beforeSheets.get(name);
    if (!sheet) {
      continue;
    }
    removedCells.push(...sheet.cells.map((cell) => ({ sheet: name, address: cell.address })));
    removedValidations.push(
      ...sheet.validations.map((entry) => ({ sheet: name, range: entry.range })),
    );
    removedFormats.push(...sheet.formats.map((entry) => ({ sheet: name, range: entry.range })));
    removedWidths.push(...sheet.columnWidths.map((entry) => ({ sheet: name, column: entry.column })));
  }

  for (const name of sharedNames) {
    const previous = beforeSheets.get(name);
    const next = afterSheets.get(name);
    if (!previous || !next) {
      continue;
    }

    const cells = keyedDiff(previous.cells, next.cells, cellKey, cellPayload);
    const validations = keyedDiff(
      previous.validations,
      next.validations,
      (entry) => entry.range,
      (entry) => digestJson(entry.rule),
    );
    const formats = keyedDiff(
      previous.formats,
      next.formats,
      (entry) => entry.range,
      (entry) => digestJson(entry.format),
    );
    const widths = keyedDiff(
      previous.columnWidths,
      next.columnWidths,
      (entry) => entry.column,
      (entry) => String(entry.width),
    );
    const frozenChanged =
      previous.frozen.rows !== next.frozen.rows || previous.frozen.columns !== next.frozen.columns;

    addedCells.push(...cells.added.map((cell) => ({ sheet: name, address: cell.address })));
    removedCells.push(...cells.removed.map((cell) => ({ sheet: name, address: cell.address })));
    changedCells.push(...cells.changed.map((cell) => ({ sheet: name, address: cell.address })));
    addedValidations.push(
      ...validations.added.map((entry) => ({ sheet: name, range: entry.range })),
    );
    removedValidations.push(
      ...validations.removed.map((entry) => ({ sheet: name, range: entry.range })),
    );
    changedValidations.push(
      ...validations.changed.map((entry) => ({ sheet: name, range: entry.range })),
    );
    addedFormats.push(...formats.added.map((entry) => ({ sheet: name, range: entry.range })));
    removedFormats.push(...formats.removed.map((entry) => ({ sheet: name, range: entry.range })));
    changedFormats.push(...formats.changed.map((entry) => ({ sheet: name, range: entry.range })));
    addedWidths.push(...widths.added.map((entry) => ({ sheet: name, column: entry.column })));
    removedWidths.push(...widths.removed.map((entry) => ({ sheet: name, column: entry.column })));
    changedWidths.push(...widths.changed.map((entry) => ({ sheet: name, column: entry.column })));
    if (frozenChanged) {
      changedFrozen.push(name);
    }

    if (
      cells.added.length +
        cells.removed.length +
        cells.changed.length +
        validations.added.length +
        validations.removed.length +
        validations.changed.length +
        formats.added.length +
        formats.removed.length +
        formats.changed.length +
        widths.added.length +
        widths.removed.length +
        widths.changed.length >
        0 ||
      frozenChanged
    ) {
      changedSheets.push(name);
    }
  }

  return {
    sheets: { added: addedSheets, removed: removedSheets, changed: changedSheets },
    cells: { added: addedCells, removed: removedCells, changed: changedCells },
    validations: {
      added: addedValidations,
      removed: removedValidations,
      changed: changedValidations,
    },
    formats: { added: addedFormats, removed: removedFormats, changed: changedFormats },
    frozen: { changed: changedFrozen },
    columnWidths: { added: addedWidths, removed: removedWidths, changed: changedWidths },
  };
}

export function emptySemanticDiff(): SemanticDiff {
  return {
    sheets: { added: [], removed: [], changed: [] },
    cells: { added: [], removed: [], changed: [] },
    validations: { added: [], removed: [], changed: [] },
    formats: { added: [], removed: [], changed: [] },
    frozen: { changed: [] },
    columnWidths: { added: [], removed: [], changed: [] },
  };
}

export function rangeCellPayload(
  workbook: SnapshotSourceWorkbook,
  sheetName: string,
  range: string,
): unknown {
  const parsed = parseA1Range(range);
  const sheet = workbook.sheets[sheetName];
  const cells: Array<{ address: string; cell: SnapshotSourceCell | null }> = [];
  for (let row = parsed.startRow; row <= parsed.endRow; row += 1) {
    for (let column = parsed.startColumn; column <= parsed.endColumn; column += 1) {
      const address = `${columnNumberToName(column)}${row}`;
      cells.push({
        address,
        cell: sheet?.cells[address] ?? null,
      });
    }
  }
  return {
    sheet: sheetName,
    range: parsed.normalized,
    exists: sheet !== undefined,
    cells,
  };
}
