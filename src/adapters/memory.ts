import { digestJson } from "../core/canonical.js";
import { compilePlan, operationTouchedCells } from "../core/plan.js";
import { DEFAULT_POLICY, evaluatePolicy, type SheetPolicy } from "../core/policy.js";
import { columnNumberToName, parseA1Range } from "../core/range.js";
import type {
  CellFormat,
  CellValue,
  ExecutionReceipt,
  SheetOperation,
  SheetPlan,
  ValidationRule,
} from "../core/types.js";

export type MemoryCell =
  | { readonly kind: "value"; readonly value: CellValue }
  | { readonly kind: "formula"; readonly formula: string };

export interface MemorySheet {
  readonly cells: Record<string, MemoryCell>;
  readonly validations: Record<string, ValidationRule>;
  readonly formats: Record<string, CellFormat>;
  frozen: { readonly rows: number; readonly columns: number };
  readonly columnWidths: Record<string, number>;
}

export interface MemoryWorkbook {
  readonly id: string;
  readonly sheets: Record<string, MemorySheet>;
}

export interface MemoryExecutionOptions {
  readonly dryRun?: boolean;
  readonly policy?: SheetPolicy;
  readonly executor?: string;
  readonly now?: () => string;
}

export interface MemoryExecutionResult {
  readonly workbook: MemoryWorkbook;
  readonly receipt: ExecutionReceipt;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createEmptySheet(): MemorySheet {
  return {
    cells: {},
    validations: {},
    formats: {},
    frozen: { rows: 0, columns: 0 },
    columnWidths: {},
  };
}

export function createEmptyWorkbook(id = "memory-workbook"): MemoryWorkbook {
  return { id, sheets: {} };
}

function requireSheet(workbook: MemoryWorkbook, sheetName: string): MemorySheet {
  const sheet = workbook.sheets[sheetName];
  if (!sheet) {
    throw new Error(`Memory adapter cannot find sheet '${sheetName}'. Add ensure-sheet first.`);
  }
  return sheet;
}

function writeMatrix(
  sheet: MemorySheet,
  range: string,
  matrix: readonly (readonly (CellValue | string)[])[],
  formulaMode: boolean,
): void {
  const parsed = parseA1Range(range);
  matrix.forEach((row, rowOffset) => {
    row.forEach((item, columnOffset) => {
      const address = `${columnNumberToName(parsed.startColumn + columnOffset)}${parsed.startRow + rowOffset}`;
      sheet.cells[address] = formulaMode
        ? { kind: "formula", formula: String(item) }
        : { kind: "value", value: item as CellValue };
    });
  });
}

function applyOperation(workbook: MemoryWorkbook, operation: SheetOperation): void {
  switch (operation.kind) {
    case "ensure-sheet":
      workbook.sheets[operation.sheet] ??= createEmptySheet();
      return;
    case "write-range":
      writeMatrix(requireSheet(workbook, operation.sheet), operation.range, operation.values, false);
      return;
    case "write-formulas":
      writeMatrix(requireSheet(workbook, operation.sheet), operation.range, operation.formulas, true);
      return;
    case "set-data-validation":
      requireSheet(workbook, operation.sheet).validations[parseA1Range(operation.range).normalized] =
        operation.rule;
      return;
    case "set-format":
      requireSheet(workbook, operation.sheet).formats[parseA1Range(operation.range).normalized] =
        operation.format;
      return;
    case "freeze-pane":
      requireSheet(workbook, operation.sheet).frozen = {
        rows: operation.rows,
        columns: operation.columns,
      };
      return;
    case "set-column-widths": {
      const sheet = requireSheet(workbook, operation.sheet);
      operation.widths.forEach(({ column, width }) => {
        sheet.columnWidths[column] = width;
      });
    }
  }
}

export function executeInMemory(
  plan: SheetPlan,
  workbook: MemoryWorkbook,
  options: MemoryExecutionOptions = {},
): MemoryExecutionResult {
  const compiled = compilePlan(plan);
  const policy = options.policy ?? DEFAULT_POLICY;
  const decision = evaluatePolicy(plan, policy);
  const beforeDigest = digestJson(workbook);
  const executedAt = (options.now ?? (() => new Date().toISOString()))();
  const executor = options.executor ?? "opensheet-ai/memory";

  if (decision.status === "blocked") {
    return {
      workbook: deepClone(workbook),
      receipt: {
        schemaVersion: "opensheet.receipt.v1",
        planDigest: compiled.digest,
        status: "blocked",
        executedAt,
        executor,
        beforeDigest,
        afterDigest: beforeDigest,
        operations: plan.operations.map((operation) => ({
          operationId: operation.id,
          status: "blocked",
          touchedCells: operationTouchedCells(operation),
        })),
        findings: decision.findings,
      },
    };
  }

  const projectedWorkbook = deepClone(workbook);
  plan.operations.forEach((operation) => applyOperation(projectedWorkbook, operation));
  const projectedAfterDigest = digestJson(projectedWorkbook);
  const dryRun = options.dryRun ?? true;
  const operations = plan.operations.map((operation) => ({
    operationId: operation.id,
    status: dryRun ? ("planned" as const) : ("applied" as const),
    touchedCells: operationTouchedCells(operation),
  }));

  if (dryRun) {
    return {
      workbook: deepClone(workbook),
      receipt: {
        schemaVersion: "opensheet.receipt.v1",
        planDigest: compiled.digest,
        status: "dry-run",
        executedAt,
        executor,
        beforeDigest,
        afterDigest: beforeDigest,
        projectedAfterDigest,
        operations,
        findings: [],
      },
    };
  }

  return {
    workbook: projectedWorkbook,
    receipt: {
      schemaVersion: "opensheet.receipt.v1",
      planDigest: compiled.digest,
      status: "applied",
      executedAt,
      executor,
      beforeDigest,
      afterDigest: projectedAfterDigest,
      operations,
      findings: [],
    },
  };
}
