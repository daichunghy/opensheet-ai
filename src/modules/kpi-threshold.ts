import { digestJson } from "../core/canonical.js";
import { compilePlan } from "../core/plan.js";
import type { CellValue, CompiledPlan, SheetPlan } from "../core/types.js";
import { parseKpiThresholdIntent } from "./intent.js";

export interface KpiThresholdItem {
  readonly code: string;
  readonly name: string;
  readonly actual: number;
  readonly target: number;
  readonly warnBelow?: number;
  readonly unit?: string;
}

export interface KpiThresholdIntent {
  readonly module: "kpi-threshold";
  readonly version: 1;
  readonly workbook: string;
  readonly sheetName?: string;
  readonly kpis: readonly KpiThresholdItem[];
}

export type KpiStatus = "met" | "watch" | "below";

export function kpiStatus(item: KpiThresholdItem): KpiStatus {
  if (item.actual >= item.target) {
    return "met";
  }
  if (item.warnBelow !== undefined && item.actual >= item.warnBelow) {
    return "watch";
  }
  return "below";
}

export function compileKpiThreshold(input: unknown): CompiledPlan {
  const intent = parseKpiThresholdIntent(input);
  const sheet = intent.sheetName ?? "KPI Thresholds";
  const headers: CellValue[] = [
    "KPI Code",
    "KPI",
    "Actual",
    "Target",
    "Gap",
    "Status",
    "Unit",
  ];
  const rows: CellValue[][] = intent.kpis.map((item) => [
    item.code,
    item.name,
    item.actual,
    item.target,
    Number((item.actual - item.target).toFixed(6)),
    kpiStatus(item),
    item.unit ?? "",
  ]);
  const rowCount = rows.length + 1;
  const plan: SheetPlan = {
    schemaVersion: "opensheet.plan.v1",
    planId: `kpi-threshold-${digestJson(intent).slice(7, 23)}`,
    source: { module: "kpi-threshold", version: "1" },
    target: { workbook: intent.workbook },
    operations: [
      { id: "kpi.ensure", kind: "ensure-sheet", sheet },
      {
        id: "kpi.write",
        kind: "write-range",
        sheet,
        range: `A1:G${rowCount}`,
        values: [headers, ...rows],
      },
      {
        id: "kpi.header-format",
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
      {
        id: "kpi.status-validation",
        kind: "set-data-validation",
        sheet,
        range: `F2:F${rowCount}`,
        rule: { kind: "list", values: ["met", "watch", "below"], allowBlank: false },
      },
      { id: "kpi.freeze", kind: "freeze-pane", sheet, rows: 1, columns: 0 },
      {
        id: "kpi.widths",
        kind: "set-column-widths",
        sheet,
        widths: [
          { column: "A", width: 16 },
          { column: "B", width: 28 },
          { column: "C", width: 12 },
          { column: "D", width: 12 },
          { column: "E", width: 12 },
          { column: "F", width: 12 },
          { column: "G", width: 12 },
        ],
      },
    ],
    metadata: {
      kpiCount: String(intent.kpis.length),
    },
  };

  return compilePlan(plan);
}
