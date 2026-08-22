export { canonicalize, digestJson } from "./core/canonical.js";
export { compilePlan, operationTouchedCells, summarizePlan } from "./core/plan.js";
export { DEFAULT_POLICY, evaluatePolicy, type SheetPolicy } from "./core/policy.js";
export { columnNumberToName, parseA1Range, type ParsedRange } from "./core/range.js";
export { assertSheetPlan, PlanValidationError } from "./core/validation.js";
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
  createEmptyWorkbook,
  executeInMemory,
  type MemoryCell,
  type MemoryExecutionOptions,
  type MemoryExecutionResult,
  type MemorySheet,
  type MemoryWorkbook,
} from "./adapters/memory.js";
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
