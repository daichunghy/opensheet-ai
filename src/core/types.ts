export type CellValue = string | number | boolean | null;

export interface PlanSource {
  readonly module: string;
  readonly version: string;
}

export interface PlanTarget {
  readonly workbook: string;
}

export interface EnsureSheetOperation {
  readonly id: string;
  readonly kind: "ensure-sheet";
  readonly sheet: string;
}

export interface WriteRangeOperation {
  readonly id: string;
  readonly kind: "write-range";
  readonly sheet: string;
  readonly range: string;
  readonly values: readonly (readonly CellValue[])[];
}

export interface WriteFormulasOperation {
  readonly id: string;
  readonly kind: "write-formulas";
  readonly sheet: string;
  readonly range: string;
  readonly formulas: readonly (readonly string[])[];
}

export type ValidationRule =
  | {
      readonly kind: "list";
      readonly values: readonly CellValue[];
      readonly allowBlank: boolean;
    }
  | {
      readonly kind: "number-between";
      readonly min: number;
      readonly max: number;
      readonly allowBlank: boolean;
    };

export interface SetDataValidationOperation {
  readonly id: string;
  readonly kind: "set-data-validation";
  readonly sheet: string;
  readonly range: string;
  readonly rule: ValidationRule;
}

export interface CellFormat {
  readonly bold?: boolean;
  readonly backgroundColor?: string;
  readonly wrap?: boolean;
  readonly horizontalAlignment?: "left" | "center" | "right";
}

export interface SetFormatOperation {
  readonly id: string;
  readonly kind: "set-format";
  readonly sheet: string;
  readonly range: string;
  readonly format: CellFormat;
}

export interface FreezePaneOperation {
  readonly id: string;
  readonly kind: "freeze-pane";
  readonly sheet: string;
  readonly rows: number;
  readonly columns: number;
}

export interface ColumnWidth {
  readonly column: string;
  readonly width: number;
}

export interface SetColumnWidthsOperation {
  readonly id: string;
  readonly kind: "set-column-widths";
  readonly sheet: string;
  readonly widths: readonly ColumnWidth[];
}

export type SheetOperation =
  | EnsureSheetOperation
  | WriteRangeOperation
  | WriteFormulasOperation
  | SetDataValidationOperation
  | SetFormatOperation
  | FreezePaneOperation
  | SetColumnWidthsOperation;

export interface SheetPlan {
  readonly schemaVersion: "opensheet.plan.v1";
  readonly planId: string;
  readonly source: PlanSource;
  readonly target: PlanTarget;
  readonly operations: readonly SheetOperation[];
  readonly metadata: Readonly<Record<string, string>>;
}

export interface PlanSummary {
  readonly operationCount: number;
  readonly touchedCellCount: number;
  readonly sheets: readonly string[];
  readonly containsFormulaWrites: boolean;
}

export interface CompiledPlan {
  readonly plan: SheetPlan;
  readonly digest: string;
  readonly summary: PlanSummary;
}

export interface PolicyFinding {
  readonly code: string;
  readonly message: string;
  readonly operationId?: string;
}

export interface PolicyDecision {
  readonly status: "pass" | "blocked";
  readonly findings: readonly PolicyFinding[];
}

export interface OperationReceipt {
  readonly operationId: string;
  readonly status: "planned" | "applied" | "blocked";
  readonly touchedCells: number;
}

export interface ExecutionReceipt {
  readonly schemaVersion: "opensheet.receipt.v1";
  readonly planDigest: string;
  readonly status: "dry-run" | "applied" | "blocked";
  readonly executedAt: string;
  readonly executor: string;
  readonly beforeDigest: string;
  readonly afterDigest: string;
  readonly projectedAfterDigest?: string;
  readonly operations: readonly OperationReceipt[];
  readonly findings: readonly PolicyFinding[];
}
