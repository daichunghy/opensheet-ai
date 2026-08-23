import type { PolicyFinding, SheetOperation, SheetPlan } from "./types.js";
import { assertSheetPlan } from "./validation.js";

export type OperationSupport = "supported" | "unsupported";

export const PLAN_V1_OPERATION_KINDS = [
  "ensure-sheet",
  "write-range",
  "write-formulas",
  "set-data-validation",
  "set-format",
  "freeze-pane",
  "set-column-widths",
] as const satisfies readonly SheetOperation["kind"][];

export type PlanV1OperationKind = (typeof PLAN_V1_OPERATION_KINDS)[number];

export interface AdapterCapability {
  readonly schemaVersion: "opensheet.capability.v1";
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly planVersions: readonly "opensheet.plan.v1"[];
  readonly operations: Readonly<Record<SheetOperation["kind"], OperationSupport>>;
  readonly dryRun: boolean;
  readonly apply: boolean;
  readonly snapshot: boolean;
  readonly preconditions: boolean;
}

export interface PreflightResult {
  readonly status: "pass" | "blocked";
  readonly findings: readonly PolicyFinding[];
}

export function operationSupportMap(
  status: OperationSupport,
): Readonly<Record<SheetOperation["kind"], OperationSupport>> {
  return {
    "ensure-sheet": status,
    "write-range": status,
    "write-formulas": status,
    "set-data-validation": status,
    "set-format": status,
    "freeze-pane": status,
    "set-column-widths": status,
  };
}

export function preflightPlan(plan: SheetPlan, capability: AdapterCapability): PreflightResult {
  assertSheetPlan(plan);
  const findings: PolicyFinding[] = [];

  if (!capability.planVersions.includes(plan.schemaVersion)) {
    findings.push({
      code: "unsupported_plan_version",
      message: `Adapter '${capability.adapterId}' does not support plan version '${plan.schemaVersion}'.`,
    });
  }

  for (const operation of plan.operations) {
    if (capability.operations[operation.kind] !== "supported") {
      findings.push({
        code: "unsupported_operation",
        message: `Adapter '${capability.adapterId}' does not support operation kind '${operation.kind}'.`,
        operationId: operation.id,
      });
    }
  }

  return {
    status: findings.length === 0 ? "pass" : "blocked",
    findings,
  };
}
