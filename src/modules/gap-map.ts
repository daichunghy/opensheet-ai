import { digestJson } from "../core/canonical.js";
import { compilePlan } from "../core/plan.js";
import type { CellValue, CompiledPlan, SheetPlan } from "../core/types.js";

export interface ExpectedConstruct {
  readonly code: string;
  readonly name: string;
  readonly minimumItems: number;
}

export interface ObservedColumn {
  readonly column: string;
  readonly constructCode: string;
  readonly itemCode: string;
}

export interface GapMapIntent {
  readonly module: "gap-map";
  readonly version: 1;
  readonly workbook: string;
  readonly sheetName?: string;
  readonly expected: readonly ExpectedConstruct[];
  readonly observed: readonly ObservedColumn[];
}

function validateIntent(intent: GapMapIntent): void {
  if (intent.module !== "gap-map" || intent.version !== 1) {
    throw new TypeError("Gap map intent must use module 'gap-map' and version 1.");
  }
  if (intent.workbook.trim().length === 0) {
    throw new TypeError("Gap map intent requires a workbook id.");
  }
  if (intent.expected.length === 0) {
    throw new TypeError("Gap map intent requires at least one expected construct.");
  }
  const expectedCodes = new Set<string>();
  intent.expected.forEach((construct) => {
    if (construct.code.trim().length === 0 || construct.name.trim().length === 0) {
      throw new TypeError("Expected construct code and name must not be blank.");
    }
    if (!Number.isInteger(construct.minimumItems) || construct.minimumItems < 1) {
      throw new TypeError(`Construct ${construct.code} requires minimumItems >= 1.`);
    }
    if (expectedCodes.has(construct.code)) {
      throw new TypeError(`Duplicate expected construct code: ${construct.code}`);
    }
    expectedCodes.add(construct.code);
  });

  const observedColumns = new Set<string>();
  intent.observed.forEach((column) => {
    if (!/^[A-Z]{1,3}$/.test(column.column)) {
      throw new TypeError(`Observed column '${column.column}' must be an uppercase A1 column name.`);
    }
    if (column.constructCode.trim().length === 0 || column.itemCode.trim().length === 0) {
      throw new TypeError("Observed construct and item codes must not be blank.");
    }
    if (observedColumns.has(column.column)) {
      throw new TypeError(`Observed column appears more than once: ${column.column}`);
    }
    observedColumns.add(column.column);
  });
}

export function compileGapMap(intent: GapMapIntent): CompiledPlan {
  validateIntent(intent);
  const sheet = intent.sheetName ?? "Gap Map";
  const observedByConstruct = new Map<string, ObservedColumn[]>();
  intent.observed.forEach((column) => {
    const current = observedByConstruct.get(column.constructCode) ?? [];
    current.push(column);
    observedByConstruct.set(column.constructCode, current);
  });

  const expectedRows: CellValue[][] = intent.expected.map((construct) => {
    const observed = observedByConstruct.get(construct.code) ?? [];
    const gap = Math.max(construct.minimumItems - observed.length, 0);
    const status = observed.length === 0 ? "missing" : gap > 0 ? "partial" : "covered";
    return [
      construct.code,
      construct.name,
      construct.minimumItems,
      observed.length,
      gap,
      status,
      observed.map((column) => `${column.column}:${column.itemCode}`).join(", "),
    ];
  });

  const expectedCodes = new Set(intent.expected.map((construct) => construct.code));
  const unexpectedRows: CellValue[][] = [...observedByConstruct.entries()]
    .filter(([constructCode]) => !expectedCodes.has(constructCode))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([constructCode, observed]) => [
      constructCode,
      "Unmapped construct",
      0,
      observed.length,
      0,
      "unexpected",
      observed.map((column) => `${column.column}:${column.itemCode}`).join(", "),
    ]);

  const headers: CellValue[] = [
    "Construct Code",
    "Construct",
    "Minimum Items",
    "Observed Items",
    "Gap",
    "Status",
    "Observed Columns",
  ];
  const rows = [...expectedRows, ...unexpectedRows];
  const rowCount = rows.length + 1;
  const plan: SheetPlan = {
    schemaVersion: "opensheet.plan.v1",
    planId: `gap-map-${digestJson(intent).slice(7, 23)}`,
    source: { module: "gap-map", version: "1" },
    target: { workbook: intent.workbook },
    operations: [
      { id: "gap.ensure", kind: "ensure-sheet", sheet },
      {
        id: "gap.write",
        kind: "write-range",
        sheet,
        range: `A1:G${rowCount}`,
        values: [headers, ...rows],
      },
      {
        id: "gap.header-format",
        kind: "set-format",
        sheet,
        range: "A1:G1",
        format: {
          bold: true,
          backgroundColor: "#DCEFEA",
          wrap: true,
          horizontalAlignment: "center",
        },
      },
      { id: "gap.freeze", kind: "freeze-pane", sheet, rows: 1, columns: 0 },
      {
        id: "gap.widths",
        kind: "set-column-widths",
        sheet,
        widths: [
          { column: "A", width: 18 },
          { column: "B", width: 30 },
          { column: "C", width: 16 },
          { column: "D", width: 16 },
          { column: "E", width: 10 },
          { column: "F", width: 14 },
          { column: "G", width: 40 },
        ],
      },
    ],
    metadata: {
      expectedConstructCount: String(intent.expected.length),
      unexpectedConstructCount: String(unexpectedRows.length),
      observedColumnCount: String(intent.observed.length),
    },
  };

  return compilePlan(plan);
}
