export { canonicalize, digestJson } from "./core/canonical.js";
export { compilePlan, operationTouchedCells, summarizePlan } from "./core/plan.js";
export { DEFAULT_POLICY, evaluatePolicy, type SheetPolicy } from "./core/policy.js";
export { columnNumberToName, parseA1Range, parseColumnName, type ParsedRange } from "./core/range.js";
export { assertSheetPlan, PlanValidationError } from "./core/validation.js";
export {
  ERROR_CODES,
  IntentValidationError,
  PolicyConfigurationError,
  RangeParseError,
  type ErrorCode,
  type PlanIssue,
} from "./core/errors.js";
export {
  PLAN_V1_OPERATION_KINDS,
  operationSupportMap,
  preflightPlan,
  type AdapterCapability,
  type OperationSupport,
  type PlanV1OperationKind,
  type PreflightResult,
} from "./core/capability.js";
export type {
  AdapterExecutionOptions,
  AdapterExecutionResult,
  SheetAdapter,
} from "./core/adapter.js";
export {
  diffSnapshots,
  digestSnapshot,
  emptySemanticDiff,
  explodeSnapshot,
  snapshotMemoryWorkbook,
  type CellRef,
  type ColumnRef,
  type RangeRef,
  type SemanticDiff,
  type SnapshotCell,
  type SnapshotColumnWidth,
  type SnapshotFormat,
  type SnapshotSheet,
  type SnapshotSourceWorkbook,
  type SnapshotValidation,
  type WorkbookSnapshot,
} from "./core/snapshot.js";
export {
  digestRangeState,
  evaluatePreconditions,
  evaluateWorkbookBinding,
  preflightSheetTargets,
  type PlanPreconditions,
  type RangeStateDigest,
} from "./core/preconditions.js";
export { IDEMPOTENT_REPLAY_FINDING, isIdempotentReplay } from "./core/idempotency.js";
export {
  verifyReceipt,
  type ReceiptVerificationInput,
  type ReceiptVerificationResult,
} from "./core/receipt.js";
export type {
  CellFormat,
  CellValue,
  CompiledPlan,
  ExecutionReceipt,
  PlanSummary,
  PolicyDecision,
  PolicyFinding,
  SheetOperation,
  SheetPlan,
  ValidationRule,
} from "./core/types.js";
export {
  compileScaleBank,
  type ScaleBankConstruct,
  type ScaleBankIntent,
  type ScaleBankItem,
} from "./modules/scale-bank.js";
export {
  compileGapMap,
  type ExpectedConstruct,
  type GapMapIntent,
  type ObservedColumn,
} from "./modules/gap-map.js";
export { parseGapMapIntent, parseKpiThresholdIntent, parseScaleBankIntent } from "./modules/intent.js";
export {
  compileKpiThreshold,
  kpiStatus,
  type KpiStatus,
  type KpiThresholdIntent,
  type KpiThresholdItem,
} from "./modules/kpi-threshold.js";
