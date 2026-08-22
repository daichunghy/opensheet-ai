import { operationTouchedCells } from "./plan.js";
import type { PolicyDecision, PolicyFinding, SheetPlan } from "./types.js";
import { assertSheetPlan } from "./validation.js";

export interface SheetPolicy {
  readonly maxOperations: number;
  readonly maxTouchedCells: number;
  readonly allowSheetCreation: boolean;
  readonly allowFormulaWrites: boolean;
  readonly allowFormatting: boolean;
  readonly allowedSheets?: readonly string[];
}

export const DEFAULT_POLICY: SheetPolicy = {
  maxOperations: 100,
  maxTouchedCells: 50_000,
  allowSheetCreation: true,
  allowFormulaWrites: false,
  allowFormatting: true,
};

function assertPolicy(policy: SheetPolicy): void {
  if (!Number.isInteger(policy.maxOperations) || policy.maxOperations < 0) {
    throw new TypeError("Policy maxOperations must be a non-negative integer.");
  }
  if (!Number.isInteger(policy.maxTouchedCells) || policy.maxTouchedCells < 0) {
    throw new TypeError("Policy maxTouchedCells must be a non-negative integer.");
  }
  if (
    typeof policy.allowSheetCreation !== "boolean" ||
    typeof policy.allowFormulaWrites !== "boolean" ||
    typeof policy.allowFormatting !== "boolean"
  ) {
    throw new TypeError("Policy permission fields must be booleans.");
  }
  if (
    policy.allowedSheets !== undefined &&
    (!Array.isArray(policy.allowedSheets) ||
      policy.allowedSheets.some((sheet) => typeof sheet !== "string" || sheet.length === 0))
  ) {
    throw new TypeError("Policy allowedSheets must be an array of non-empty strings.");
  }
}

export function evaluatePolicy(
  plan: SheetPlan,
  policy: SheetPolicy = DEFAULT_POLICY,
): PolicyDecision {
  assertSheetPlan(plan);
  assertPolicy(policy);
  const findings: PolicyFinding[] = [];

  if (plan.operations.length > policy.maxOperations) {
    findings.push({
      code: "operation_budget_exceeded",
      message: `Plan has ${plan.operations.length} operations; policy allows ${policy.maxOperations}.`,
    });
  }

  const touchedCells = plan.operations.reduce(
    (total, operation) => total + operationTouchedCells(operation),
    0,
  );
  if (touchedCells > policy.maxTouchedCells) {
    findings.push({
      code: "cell_budget_exceeded",
      message: `Plan touches ${touchedCells} cells; policy allows ${policy.maxTouchedCells}.`,
    });
  }

  for (const operation of plan.operations) {
    if (policy.allowedSheets && !policy.allowedSheets.includes(operation.sheet)) {
      findings.push({
        code: "sheet_not_allowed",
        message: `Sheet '${operation.sheet}' is not on the policy allowlist.`,
        operationId: operation.id,
      });
    }
    if (!policy.allowSheetCreation && operation.kind === "ensure-sheet") {
      findings.push({
        code: "sheet_creation_blocked",
        message: "Policy does not allow sheet creation.",
        operationId: operation.id,
      });
    }
    if (!policy.allowFormulaWrites && operation.kind === "write-formulas") {
      findings.push({
        code: "formula_write_blocked",
        message: "Formula writes require an explicit policy opt-in.",
        operationId: operation.id,
      });
    }
    if (!policy.allowFormatting && operation.kind === "set-format") {
      findings.push({
        code: "formatting_blocked",
        message: "Policy does not allow formatting operations.",
        operationId: operation.id,
      });
    }
  }

  return {
    status: findings.length === 0 ? "pass" : "blocked",
    findings,
  };
}
