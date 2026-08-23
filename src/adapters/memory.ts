import type { SheetAdapter } from "../core/adapter.js";
import {
  operationSupportMap,
  preflightPlan,
  type AdapterCapability,
} from "../core/capability.js";
import { ERROR_CODES, planIssue } from "../core/errors.js";
import { snapshotMemoryWorkbook } from "../core/snapshot.js";
import { validateSheetName } from "../core/validation.js";
import { digestJson } from "../core/canonical.js";
import { IDEMPOTENT_REPLAY_FINDING, isIdempotentReplay } from "../core/idempotency.js";
import { compilePlan, operationTouchedCells } from "../core/plan.js";
import { DEFAULT_POLICY, evaluatePolicy, type SheetPolicy } from "../core/policy.js";
import {
  evaluatePreconditions,
  evaluateWorkbookBinding,
  preflightSheetTargets,
  type PlanPreconditions,
} from "../core/preconditions.js";
import { columnNumberToName, parseA1Range } from "../core/range.js";
import type {
  CellFormat,
  CellValue,
  ExecutionReceipt,
  PolicyFinding,
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
  readonly frozen: { readonly rows: number; readonly columns: number };
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
  readonly capability?: AdapterCapability;
  readonly preconditions?: PlanPreconditions;
  readonly previousReceipt?: ExecutionReceipt;
}

export interface MemoryExecutionResult {
  readonly workbook: MemoryWorkbook;
  readonly receipt: ExecutionReceipt;
}

export const MEMORY_CAPABILITY: AdapterCapability = Object.freeze({
  schemaVersion: "opensheet.capability.v1",
  adapterId: "opensheet-ai/memory",
  adapterVersion: "0.0.0-dev",
  planVersions: ["opensheet.plan.v1"] as const,
  operations: Object.freeze(operationSupportMap("supported")),
  dryRun: true,
  apply: true,
  snapshot: true,
  preconditions: true,
});

function dictionary<T extends object>(value?: T): T {
  return Object.assign(Object.create(null), value) as T;
}

function normalizeWorkbook(workbook: MemoryWorkbook): MemoryWorkbook {
  const sheets = dictionary<Record<string, MemorySheet>>();
  for (const [name, sheet] of Object.entries(workbook.sheets)) {
    sheets[name] = {
      cells: dictionary(sheet.cells),
      validations: dictionary(sheet.validations),
      formats: dictionary(sheet.formats),
      frozen: { rows: sheet.frozen.rows, columns: sheet.frozen.columns },
      columnWidths: dictionary(sheet.columnWidths),
    };
  }
  return { id: workbook.id, sheets };
}

function deepClone(workbook: MemoryWorkbook): MemoryWorkbook {
  return normalizeWorkbook(JSON.parse(JSON.stringify(workbook)) as MemoryWorkbook);
}

function createEmptySheet(): MemorySheet {
  return {
    cells: dictionary(),
    validations: dictionary(),
    formats: dictionary(),
    frozen: { rows: 0, columns: 0 },
    columnWidths: dictionary(),
  };
}

export function createEmptyWorkbook(id = "memory-workbook"): MemoryWorkbook {
  return { id, sheets: dictionary() };
}

export class MemoryWorkbookError extends Error {
  public readonly details: readonly { readonly code: string; readonly path: string; readonly message: string }[];

  public constructor(details: readonly { readonly code: string; readonly path: string; readonly message: string }[]) {
    super(`Invalid memory workbook:\n- ${details.map((detail) => detail.message).join("\n- ")}`);
    this.name = "MemoryWorkbookError";
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCell(value: unknown, path: string, issues: { code: string; path: string; message: string }[]): MemoryCell | undefined {
  if (!isRecord(value) || typeof value["kind"] !== "string") {
    issues.push(planIssue(ERROR_CODES.invalid_intent, path, `${path} must be a memory cell object.`));
    return undefined;
  }
  if (value["kind"] === "value") {
    const cellValue = value["value"];
    if (cellValue !== null && !["string", "number", "boolean"].includes(typeof cellValue)) {
      issues.push(planIssue(ERROR_CODES.invalid_cell_value, `${path}.value`, `${path}.value is not a JSON cell value.`));
      return undefined;
    }
    if (typeof cellValue === "number" && !Number.isFinite(cellValue)) {
      issues.push(planIssue(ERROR_CODES.invalid_cell_value, `${path}.value`, `${path}.value must be finite.`));
      return undefined;
    }
    return { kind: "value", value: cellValue as CellValue };
  }
  if (value["kind"] === "formula" && typeof value["formula"] === "string") {
    return { kind: "formula", formula: value["formula"] };
  }
  issues.push(planIssue(ERROR_CODES.invalid_intent, path, `${path} has an unsupported cell kind.`));
  return undefined;
}

export function parseMemoryWorkbook(value: unknown): MemoryWorkbook {
  const issues: { code: string; path: string; message: string }[] = [];
  if (!isRecord(value)) {
    throw new MemoryWorkbookError([planIssue(ERROR_CODES.invalid_intent, "workbook", "Workbook must be an object.")]);
  }
  if (typeof value["id"] !== "string" || value["id"].length < 1 || value["id"].length > 120) {
    issues.push(planIssue(ERROR_CODES.invalid_identifier, "id", "id must be a string from 1 to 120 characters."));
  }
  const sheetsValue = value["sheets"];
  if (!isRecord(sheetsValue)) {
    issues.push(planIssue(ERROR_CODES.invalid_intent, "sheets", "sheets must be an object."));
    throw new MemoryWorkbookError(issues);
  }
  const sheets = dictionary<Record<string, MemorySheet>>();
  for (const [name, sheetValue] of Object.entries(sheetsValue)) {
    validateSheetName(name, `sheets.${name}`, issues);
    if (!isRecord(sheetValue)) {
      issues.push(planIssue(ERROR_CODES.invalid_intent, `sheets.${name}`, `sheets.${name} must be an object.`));
      continue;
    }
    const cells = dictionary<Record<string, MemoryCell>>();
    if (!isRecord(sheetValue["cells"])) {
      issues.push(planIssue(ERROR_CODES.invalid_intent, `sheets.${name}.cells`, "cells must be an object."));
    } else {
      for (const [address, cell] of Object.entries(sheetValue["cells"])) {
        const parsed = parseCell(cell, `sheets.${name}.cells.${address}`, issues);
        if (parsed) {
          cells[address] = parsed;
        }
      }
    }
    const frozen = sheetValue["frozen"];
    const frozenRows = isRecord(frozen) ? frozen["rows"] : 0;
    const frozenColumns = isRecord(frozen) ? frozen["columns"] : 0;
    sheets[name] = {
      cells,
      validations: isRecord(sheetValue["validations"])
        ? (dictionary(sheetValue["validations"]) as MemorySheet["validations"])
        : dictionary(),
      formats: isRecord(sheetValue["formats"])
        ? (dictionary(sheetValue["formats"]) as MemorySheet["formats"])
        : dictionary(),
      frozen: {
        rows: typeof frozenRows === "number" ? frozenRows : 0,
        columns: typeof frozenColumns === "number" ? frozenColumns : 0,
      },
      columnWidths: isRecord(sheetValue["columnWidths"])
        ? (dictionary(sheetValue["columnWidths"]) as MemorySheet["columnWidths"])
        : dictionary(),
    };
  }
  if (issues.length > 0) {
    throw new MemoryWorkbookError(issues);
  }
  return { id: String(value["id"]), sheets };
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
    case "freeze-pane": {
      const sheet = requireSheet(workbook, operation.sheet);
      workbook.sheets[operation.sheet] = {
        cells: sheet.cells,
        validations: sheet.validations,
        formats: sheet.formats,
        frozen: { rows: operation.rows, columns: operation.columns },
        columnWidths: sheet.columnWidths,
      };
      return;
    }
    case "set-column-widths": {
      const sheet = requireSheet(workbook, operation.sheet);
      operation.widths.forEach(({ column, width }) => {
        sheet.columnWidths[column] = width;
      });
    }
  }
}

export function projectMemoryWorkbook(plan: SheetPlan, workbook: MemoryWorkbook): MemoryWorkbook {
  const projected = deepClone(workbook);
  plan.operations.forEach((operation) => applyOperation(projected, operation));
  return projected;
}

function blockedResult(
  plan: SheetPlan,
  workbook: MemoryWorkbook,
  compiledDigest: string,
  beforeDigest: string,
  executedAt: string,
  executor: string,
  findings: readonly PolicyFinding[],
): MemoryExecutionResult {
  return {
    workbook: deepClone(workbook),
    receipt: {
      schemaVersion: "opensheet.receipt.v1",
      planDigest: compiledDigest,
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
      findings,
    },
  };
}

export function executeInMemory(
  plan: SheetPlan,
  workbook: MemoryWorkbook,
  options: MemoryExecutionOptions = {},
): MemoryExecutionResult {
  const compiled = compilePlan(plan);
  const frozenPlan = compiled.plan;
  const policy = options.policy ?? DEFAULT_POLICY;
  const capability = options.capability ?? MEMORY_CAPABILITY;
  const decision = evaluatePolicy(frozenPlan, policy);
  const beforeDigest = digestJson(workbook);
  const executedAt = (options.now ?? (() => new Date().toISOString()))();
  const executor = options.executor ?? "opensheet-ai/memory";
  const dryRun = options.dryRun ?? true;

  if (decision.status === "blocked") {
    return blockedResult(
      frozenPlan,
      workbook,
      compiled.digest,
      beforeDigest,
      executedAt,
      executor,
      decision.findings,
    );
  }

  const binding = evaluateWorkbookBinding(frozenPlan, workbook);
  if (binding.status === "blocked") {
    return blockedResult(
      frozenPlan,
      workbook,
      compiled.digest,
      beforeDigest,
      executedAt,
      executor,
      binding.findings,
    );
  }

  const preflight = preflightPlan(frozenPlan, capability);
  if (preflight.status === "blocked") {
    return blockedResult(
      frozenPlan,
      workbook,
      compiled.digest,
      beforeDigest,
      executedAt,
      executor,
      preflight.findings,
    );
  }

  const sheetTargets = preflightSheetTargets(frozenPlan, workbook);
  if (sheetTargets.status === "blocked") {
    return blockedResult(
      frozenPlan,
      workbook,
      compiled.digest,
      beforeDigest,
      executedAt,
      executor,
      sheetTargets.findings,
    );
  }

  if (options.preconditions) {
    const preconditionDecision = evaluatePreconditions(workbook, options.preconditions);
    if (preconditionDecision.status === "blocked") {
      return blockedResult(
        frozenPlan,
        workbook,
        compiled.digest,
        beforeDigest,
        executedAt,
        executor,
        preconditionDecision.findings,
      );
    }
  }

  if (isIdempotentReplay(options.previousReceipt, compiled.digest, beforeDigest)) {
    return {
      workbook: deepClone(workbook),
      receipt: {
        schemaVersion: "opensheet.receipt.v1",
        planDigest: compiled.digest,
        status: "applied",
        executedAt,
        executor,
        beforeDigest,
        afterDigest: beforeDigest,
        operations: frozenPlan.operations.map((operation) => ({
          operationId: operation.id,
          status: "applied",
          touchedCells: operationTouchedCells(operation),
        })),
        findings: [IDEMPOTENT_REPLAY_FINDING],
      },
    };
  }

  const projectedWorkbook = projectMemoryWorkbook(frozenPlan, workbook);
  const projectedAfterDigest = digestJson(projectedWorkbook);
  const operations = frozenPlan.operations.map((operation) => ({
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

export const memoryAdapter: SheetAdapter<MemoryWorkbook> = {
  id: "opensheet-ai/memory",
  capability: () => MEMORY_CAPABILITY,
  snapshot: (workbook) => snapshotMemoryWorkbook(workbook),
  preflight: (plan, capability) => preflightPlan(plan, capability ?? MEMORY_CAPABILITY),
  preview(plan, workbook, options) {
    const result = executeInMemory(plan, workbook, { ...options, dryRun: true });
    return { snapshot: snapshotMemoryWorkbook(result.workbook), receipt: result.receipt };
  },
  apply(plan, workbook, options) {
    const result = executeInMemory(plan, workbook, { ...options, dryRun: false });
    return { snapshot: snapshotMemoryWorkbook(result.workbook), receipt: result.receipt };
  },
};
