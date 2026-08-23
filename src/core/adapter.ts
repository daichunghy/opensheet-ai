import type { AdapterCapability, PreflightResult } from "./capability.js";
import type { PlanPreconditions } from "./preconditions.js";
import type { SheetPolicy } from "./policy.js";
import type { WorkbookSnapshot } from "./snapshot.js";
import type { ExecutionReceipt, SheetPlan } from "./types.js";

export interface AdapterExecutionOptions {
  readonly dryRun?: boolean;
  readonly policy?: SheetPolicy;
  readonly executor?: string;
  readonly now?: () => string;
  readonly capability?: AdapterCapability;
  readonly preconditions?: PlanPreconditions;
  readonly previousReceipt?: ExecutionReceipt;
}

export interface AdapterExecutionResult {
  readonly snapshot: WorkbookSnapshot;
  readonly receipt: ExecutionReceipt;
}

export interface SheetAdapter<TWorkbook = unknown> {
  readonly id: string;
  capability(): AdapterCapability;
  snapshot(workbook: TWorkbook): WorkbookSnapshot;
  preflight(plan: SheetPlan, capability?: AdapterCapability): PreflightResult;
  preview(
    plan: SheetPlan,
    workbook: TWorkbook,
    options?: AdapterExecutionOptions,
  ): AdapterExecutionResult;
  apply(
    plan: SheetPlan,
    workbook: TWorkbook,
    options?: AdapterExecutionOptions,
  ): AdapterExecutionResult;
}
