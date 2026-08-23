import { digestJson } from "../core/canonical.js";
import { compilePlan } from "../core/plan.js";
import type { CellValue, CompiledPlan, SheetPlan } from "../core/types.js";
import { parseGapMapIntent } from "./intent.js";

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

export function compileGapMap(input: unknown): CompiledPlan {
  const intent = parseGapMapIntent(input);
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
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
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
