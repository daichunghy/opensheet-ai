import { digestJson } from "./canonical.js";
import { parseA1Range } from "./range.js";
import type { CompiledPlan, PlanSummary, SheetOperation, SheetPlan } from "./types.js";
import { assertSheetPlan } from "./validation.js";

export function operationTouchedCells(operation: SheetOperation): number {
  switch (operation.kind) {
    case "write-range":
    case "write-formulas":
    case "set-data-validation":
    case "set-format":
      return parseA1Range(operation.range).cellCount;
    case "ensure-sheet":
    case "freeze-pane":
    case "set-column-widths":
      return 0;
  }
}

export function summarizePlan(plan: SheetPlan): PlanSummary {
  assertSheetPlan(plan);
  return {
    operationCount: plan.operations.length,
    touchedCellCount: plan.operations.reduce(
      (total, operation) => total + operationTouchedCells(operation),
      0,
    ),
    sheets: [...new Set(plan.operations.map((operation) => operation.sheet))].sort(),
    containsFormulaWrites: plan.operations.some((operation) => operation.kind === "write-formulas"),
  };
}

export function compilePlan(input: unknown): CompiledPlan {
  assertSheetPlan(input);
  const plan = structuredClone(input);
  return {
    plan,
    digest: digestJson(plan),
    summary: summarizePlan(plan),
  };
}
