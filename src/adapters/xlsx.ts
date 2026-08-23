import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import ExcelJS from "exceljs";
import type { SheetAdapter } from "../core/adapter.js";
import {
  operationSupportMap,
  preflightPlan,
  type AdapterCapability,
} from "../core/capability.js";
import { compilePlan } from "../core/plan.js";
import { DEFAULT_POLICY, type SheetPolicy } from "../core/policy.js";
import { columnNumberToName, parseA1Range } from "../core/range.js";
import {
  explodeSnapshot,
  digestSnapshot,
  snapshotMemoryWorkbook,
  type WorkbookSnapshot,
} from "../core/snapshot.js";
import type { CellFormat, ExecutionReceipt, PolicyFinding, SheetPlan, ValidationRule } from "../core/types.js";
import {
  createEmptyWorkbook,
  executeInMemory,
  type MemoryCell,
  type MemoryExecutionOptions,
  type MemorySheet,
  type MemoryWorkbook,
} from "./memory.js";

interface ExcelValidationModel {
  type?: string;
  operator?: string;
  formulae?: unknown[];
  allowBlank?: boolean;
}

interface ExcelRuntimeCell {
  address: string;
  formula?: string;
  value: unknown;
  font?: { bold?: boolean };
  alignment?: { wrapText?: boolean; horizontal?: string };
  fill?: { type?: string; pattern?: string; fgColor?: { argb?: string } };
}

interface ExcelRuntimeSheet {
  name: string;
  model?: { merges?: unknown[] };
  views?: Array<{ state?: string; ySplit?: number; xSplit?: number }> | null;
  columnCount: number;
  getColumn(index: number | string): { width?: number };
  getCell(address: string | number, col?: number): ExcelRuntimeCell;
  eachRow(
    options: { includeEmpty: boolean },
    callback: (
      row: {
        eachCell(
          cellOptions: { includeEmpty: boolean },
          cellCallback: (cell: ExcelRuntimeCell) => void,
        ): void;
      },
    ) => void,
  ): void;
  getImages?: () => unknown[];
  dataValidations: {
    add(range: string, rule: Record<string, unknown>): void;
    model?: Record<string, ExcelValidationModel> | null;
  };
}

interface ExcelRuntimeWorkbook {
  media: unknown[];
  worksheets: ExcelRuntimeSheet[];
  addWorksheet(name: string): ExcelRuntimeSheet;
  xlsx: {
    readFile(path: string): Promise<void>;
    writeFile(path: string): Promise<void>;
  };
}

function createExcelWorkbook(): ExcelRuntimeWorkbook {
  return new ExcelJS.Workbook() as unknown as ExcelRuntimeWorkbook;
}

export const XLSX_CAPABILITY: AdapterCapability = Object.freeze({
  schemaVersion: "opensheet.capability.v1",
  adapterId: "opensheet-ai/xlsx",
  adapterVersion: "0.0.0-dev",
  planVersions: ["opensheet.plan.v1"] as const,
  operations: Object.freeze(operationSupportMap("supported")),
  dryRun: true,
  apply: true,
  snapshot: true,
  preconditions: true,
});

export interface XlsxExecutionOptions extends MemoryExecutionOptions {
  readonly inputPath?: string;
  readonly outputPath: string;
  readonly overwrite?: boolean;
  readonly allowedSheets?: readonly string[];
}

export interface XlsxExecutionResult {
  readonly workbook: MemoryWorkbook;
  readonly snapshot: WorkbookSnapshot;
  readonly receipt: ExecutionReceipt;
}

function hexToArgb(color: string): string {
  return `FF${color.slice(1).toUpperCase()}`;
}

function argbToHex(argb: string | undefined): string | undefined {
  if (!argb || argb.length < 6) {
    return undefined;
  }
  return `#${argb.slice(-6)}`;
}

function blocked(
  plan: SheetPlan,
  digest: string,
  findings: readonly PolicyFinding[],
  executedAt: string,
  before: MemoryWorkbook,
): ExecutionReceipt {
  const beforeDigest = digestSnapshot(snapshotMemoryWorkbook(before));
  return {
    schemaVersion: "opensheet.receipt.v1",
    planDigest: digest,
    status: "blocked",
    executedAt,
    executor: "opensheet-ai/xlsx",
    beforeDigest,
    afterDigest: beforeDigest,
    operations: plan.operations.map((operation) => ({
      operationId: operation.id,
      status: "blocked",
      touchedCells: 0,
    })),
    findings,
  };
}

function scanUnsupported(workbook: ExcelRuntimeWorkbook): PolicyFinding[] {
  const findings: PolicyFinding[] = [];
  if (workbook.media.length > 0) {
    findings.push({
      code: "unsupported_workbook_feature",
      message: "Input workbook contains media or drawings that v1 cannot preserve.",
    });
  }
  workbook.worksheets.forEach((sheet) => {
    const merges = sheet.model?.merges ?? [];
    if (merges.length > 0) {
      findings.push({
        code: "unsupported_workbook_feature",
        message: `Sheet '${sheet.name}' contains merged cells.`,
      });
    }
    if (typeof sheet.getImages === "function" && sheet.getImages().length > 0) {
      findings.push({
        code: "unsupported_workbook_feature",
        message: `Sheet '${sheet.name}' contains images.`,
      });
    }
  });
  return findings;
}

function applyFormat(cell: ExcelRuntimeCell, format: CellFormat): void {
  if (format.bold !== undefined) {
    cell.font = { ...(cell.font ?? {}), bold: format.bold };
  }
  if (format.wrap !== undefined || format.horizontalAlignment !== undefined) {
    cell.alignment = {
      ...(cell.alignment ?? {}),
      ...(format.wrap !== undefined ? { wrapText: format.wrap } : {}),
      ...(format.horizontalAlignment !== undefined ? { horizontal: format.horizontalAlignment } : {}),
    };
  }
  if (format.backgroundColor !== undefined) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: hexToArgb(format.backgroundColor) },
    };
  }
}

function applyValidation(sheet: ExcelRuntimeSheet, range: string, rule: ValidationRule): void {
  if (rule.kind === "list") {
    sheet.dataValidations.add(range, {
      type: "list",
      allowBlank: rule.allowBlank,
      formulae: [`"${rule.values.map((value) => String(value)).join(",")}"`],
    });
    return;
  }
  sheet.dataValidations.add(range, {
    type: "decimal",
    operator: "between",
    allowBlank: rule.allowBlank,
    formulae: [rule.min, rule.max],
  });
}

async function readToMemory(path: string, workbookId: string, rejectUnsupported = true): Promise<MemoryWorkbook> {
  const excel = createExcelWorkbook();
  await excel.xlsx.readFile(path);
  const findings = rejectUnsupported ? scanUnsupported(excel) : [];
  if (findings.length > 0) {
    const error = new Error(findings.map((finding) => finding.message).join(" "));
    (error as Error & { findings: readonly PolicyFinding[] }).findings = findings;
    throw error;
  }
  const memory = createEmptyWorkbook(workbookId);
  excel.worksheets.forEach((sheet) => {
    const cells: Record<string, MemoryCell> = {};
    const formats: MemorySheet["formats"] = {};
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
      const address = String(cell.address).replace(/\$/g, "");
      if (cell.formula) {
        cells[address] = {
          kind: "formula",
          formula: cell.formula.startsWith("=") ? cell.formula : `=${cell.formula}`,
        };
      } else {
        const value = cell.value;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
          cells[address] = { kind: "value", value };
        } else if (value !== undefined && value !== null && typeof value === "object" && "text" in value) {
          cells[address] = { kind: "value", value: String((value as { text: string }).text) };
        }
      }
      const hex =
        cell.fill?.type === "pattern" ? argbToHex(cell.fill.fgColor?.argb) : undefined;
      const horizontal =
        cell.alignment?.horizontal === "left" ||
        cell.alignment?.horizontal === "center" ||
        cell.alignment?.horizontal === "right"
          ? cell.alignment.horizontal
          : undefined;
      const format: CellFormat = {
        ...(cell.font?.bold ? { bold: true } : {}),
        ...(cell.alignment?.wrapText ? { wrap: true } : {}),
        ...(horizontal ? { horizontalAlignment: horizontal } : {}),
        ...(hex ? { backgroundColor: hex } : {}),
      };
      if (Object.keys(format).length > 0) {
        formats[parseA1Range(address).normalized] = format;
      }
      });
    });
    const validations: MemorySheet["validations"] = {};
    Object.entries(sheet.dataValidations?.model ?? {}).forEach(([range, model]) => {
      if (model.type === "list" && Array.isArray(model.formulae) && model.formulae[0] !== undefined) {
        const raw = String(model.formulae[0]).replace(/^"/, "").replace(/"$/, "");
        validations[parseA1Range(range).normalized] = {
          kind: "list",
          values: raw.split(","),
          allowBlank: Boolean(model.allowBlank),
        };
      }
      if (
        model.type === "decimal" &&
        model.operator === "between" &&
        Array.isArray(model.formulae) &&
        model.formulae.length >= 2
      ) {
        validations[parseA1Range(range).normalized] = {
          kind: "number-between",
          min: Number(model.formulae[0]),
          max: Number(model.formulae[1]),
          allowBlank: Boolean(model.allowBlank),
        };
      }
    });
    const frozenView = (sheet.views ?? []).find((view) => view.state === "frozen");
    const frozenRows = frozenView?.ySplit;
    const frozenColumns = frozenView?.xSplit;
    const columnWidths: Record<string, number> = {};
    for (let index = 1; index <= sheet.columnCount; index += 1) {
      const width = sheet.getColumn(index).width;
      if (typeof width === "number") {
        columnWidths[columnNumberToName(index)] = width;
      }
    }
    memory.sheets[sheet.name] = {
      cells,
      validations,
      formats,
      frozen: {
        rows: typeof frozenRows === "number" ? frozenRows : 0,
        columns: typeof frozenColumns === "number" ? frozenColumns : 0,
      },
      columnWidths,
    };
  });
  return memory;
}

function writeMemoryToExcel(memory: MemoryWorkbook): ExcelRuntimeWorkbook {
  const excel = createExcelWorkbook();
  Object.entries(memory.sheets).forEach(([name, sheet]) => {
    const worksheet = excel.addWorksheet(name);
    Object.entries(sheet.cells).forEach(([address, cell]) => {
      if (cell.kind === "formula") {
        worksheet.getCell(address).value = {
          formula: cell.formula.startsWith("=") ? cell.formula.slice(1) : cell.formula,
        };
      } else {
        worksheet.getCell(address).value = cell.value;
      }
    });
    Object.entries(sheet.formats).forEach(([range, format]) => {
      const parsed = parseA1Range(range);
      for (let row = parsed.startRow; row <= parsed.endRow; row += 1) {
        for (let column = parsed.startColumn; column <= parsed.endColumn; column += 1) {
          applyFormat(worksheet.getCell(`${columnNumberToName(column)}${row}`), format);
        }
      }
    });
    Object.entries(sheet.validations).forEach(([range, rule]) => {
      applyValidation(worksheet, parseA1Range(range).normalized, rule);
    });
    if (sheet.frozen.rows > 0 || sheet.frozen.columns > 0) {
      worksheet.views = [{ state: "frozen", ySplit: sheet.frozen.rows, xSplit: sheet.frozen.columns }];
    }
    Object.entries(sheet.columnWidths).forEach(([column, width]) => {
      worksheet.getColumn(column).width = width;
    });
  });
  return excel;
}

async function excelToSnapshot(path: string, workbookId: string): Promise<WorkbookSnapshot> {
  const memory = await readToMemory(path, workbookId);
  return explodeSnapshot(snapshotMemoryWorkbook(memory));
}

export async function executeXlsx(
  plan: SheetPlan,
  options: XlsxExecutionOptions,
): Promise<XlsxExecutionResult> {
  const compiled = compilePlan(plan);
  const executedAt = (options.now ?? (() => new Date().toISOString()))();
  const dryRun = options.dryRun ?? true;
  const empty = createEmptyWorkbook(plan.target.workbook);
  const hasStatePrecondition = (options.preconditions && (
    options.preconditions.workbookDigest !== undefined ||
    (options.preconditions.rangeDigests?.length ?? 0) > 0 ||
    (options.preconditions.sheetsMustExist?.length ?? 0) > 0 ||
    (options.preconditions.sheetsMustNotExist?.length ?? 0) > 0
  )) ?? false;

  let receiptInput = empty;
  if (options.inputPath) {
    try {
      receiptInput = await readToMemory(options.inputPath, plan.target.workbook, false);
    } catch {
      receiptInput = empty;
    }
  } else if (existsSync(options.outputPath)) {
    try {
      receiptInput = await readToMemory(options.outputPath, plan.target.workbook, false);
    } catch {
      receiptInput = empty;
    }
  }

  if (options.inputPath) {
    const allow = options.allowedSheets ?? options.policy?.allowedSheets;
    if (!allow || allow.length === 0) {
      return {
        workbook: empty,
        snapshot: snapshotMemoryWorkbook(empty),
        receipt: blocked(
          compiled.plan,
          compiled.digest,
          [
            {
              code: "sheet_allowlist_required",
              message: "Reading an existing .xlsx file requires an explicit sheet allowlist.",
            },
          ],
          executedAt,
          receiptInput,
        ),
      };
    }
  }

  if (!dryRun && existsSync(options.outputPath) && options.overwrite !== true) {
    return {
      workbook: empty,
      snapshot: snapshotMemoryWorkbook(empty),
      receipt: blocked(
        compiled.plan,
        compiled.digest,
        [
          {
            code: "overwrite_refused",
            message: `Refusing to overwrite ${options.outputPath} without overwrite=true.`,
          },
        ],
        executedAt,
        receiptInput,
      ),
    };
  }

  if (!dryRun && existsSync(options.outputPath) && options.overwrite === true && !options.inputPath) {
    return {
      workbook: empty,
      snapshot: snapshotMemoryWorkbook(empty),
      receipt: blocked(
        compiled.plan,
        compiled.digest,
        [{
          code: "overwrite_input_required",
          message: "Overwriting an existing .xlsx requires --in with an explicit workbook state.",
        }],
        executedAt,
        receiptInput,
      ),
    };
  }

  if (!dryRun && existsSync(options.outputPath) && options.overwrite === true && !hasStatePrecondition) {
    return {
      workbook: empty,
      snapshot: snapshotMemoryWorkbook(empty),
      receipt: blocked(
        compiled.plan,
        compiled.digest,
        [{
          code: "overwrite_precondition_required",
          message: "Overwriting an existing .xlsx requires a workbook or range precondition.",
        }],
        executedAt,
        receiptInput,
      ),
    };
  }

  let input: MemoryWorkbook = empty;
  if (options.inputPath) {
    try {
      input = await readToMemory(options.inputPath, plan.target.workbook);
    } catch (error) {
      const findings =
        error && typeof error === "object" && "findings" in error
          ? ((error as { findings: readonly PolicyFinding[] }).findings)
          : [
              {
                code: "unsupported_workbook_feature",
                message: error instanceof Error ? error.message : "Failed to read workbook.",
              },
            ];
      return {
        workbook: empty,
        snapshot: snapshotMemoryWorkbook(empty),
        receipt: blocked(compiled.plan, compiled.digest, findings, executedAt, receiptInput),
      };
    }
    const existingNames = Object.keys(input.sheets);
    const allow = new Set(options.allowedSheets ?? options.policy?.allowedSheets ?? []);
    const unlisted = existingNames.filter((name) => !allow.has(name));
    if (unlisted.length > 0) {
      return {
        workbook: empty,
        snapshot: snapshotMemoryWorkbook(empty),
        receipt: blocked(
          compiled.plan,
          compiled.digest,
          [
            {
              code: "sheet_not_allowed",
              message: `Input sheets not on the allowlist: ${unlisted.join(", ")}.`,
            },
          ],
          executedAt,
          input,
        ),
      };
    }
  }

  const policy: SheetPolicy = options.policy ?? DEFAULT_POLICY;
  const result = executeInMemory(compiled.plan, input, {
    ...options,
    policy,
    executor: options.executor ?? "opensheet-ai/xlsx",
    dryRun,
  });

  if (result.receipt.status === "blocked") {
    return {
      workbook: result.workbook,
      snapshot: snapshotMemoryWorkbook(result.workbook),
      receipt: {
        ...result.receipt,
        beforeDigest: digestSnapshot(snapshotMemoryWorkbook(input)),
        afterDigest: digestSnapshot(snapshotMemoryWorkbook(input)),
      },
    };
  }

  const projectedSnapshot = explodeSnapshot(snapshotMemoryWorkbook(result.workbook));
  if (dryRun) {
    return {
      workbook: result.workbook,
      snapshot: projectedSnapshot,
      receipt: {
        ...result.receipt,
        executor: "opensheet-ai/xlsx",
        beforeDigest: digestSnapshot(snapshotMemoryWorkbook(input)),
        afterDigest: digestSnapshot(snapshotMemoryWorkbook(input)),
        projectedAfterDigest: digestSnapshot(projectedSnapshot),
      },
    };
  }

  const excel = writeMemoryToExcel(result.workbook);
  try {
    await excel.xlsx.writeFile(options.outputPath);
    const readBack = await excelToSnapshot(options.outputPath, plan.target.workbook);
    const actualAfterDigest = digestSnapshot(readBack);
    const projectedAfterDigest = digestSnapshot(projectedSnapshot);
    if (actualAfterDigest !== projectedAfterDigest) {
      await unlink(options.outputPath).catch(() => undefined);
      return {
        workbook: input,
        snapshot: snapshotMemoryWorkbook(input),
        receipt: blocked(
          compiled.plan,
          compiled.digest,
          [{
            code: "readback_mismatch",
            message: "The written .xlsx snapshot does not match the projected workbook; output was removed.",
          }],
          executedAt,
          input,
        ),
      };
    }
    return {
      workbook: result.workbook,
      snapshot: readBack,
      receipt: {
        ...result.receipt,
        executor: "opensheet-ai/xlsx",
        beforeDigest: digestSnapshot(snapshotMemoryWorkbook(input)),
        afterDigest: actualAfterDigest,
        projectedAfterDigest,
      },
    };
  } catch (error) {
    await unlink(options.outputPath).catch(() => undefined);
    return {
      workbook: input,
      snapshot: snapshotMemoryWorkbook(input),
      receipt: blocked(
        compiled.plan,
        compiled.digest,
        [{
          code: "xlsx_write_failed",
          message: error instanceof Error ? `The .xlsx write failed: ${error.message}` : "The .xlsx write failed.",
        }],
        executedAt,
        input,
      ),
    };
  }
}

export const xlsxAdapter: SheetAdapter<MemoryWorkbook> = {
  id: "opensheet-ai/xlsx",
  capability: () => XLSX_CAPABILITY,
  snapshot: (workbook) => snapshotMemoryWorkbook(workbook),
  preflight: (plan, capability) => preflightPlan(plan, capability ?? XLSX_CAPABILITY),
  preview(plan, workbook, adapterOptions) {
    const result = executeInMemory(plan, workbook, { ...adapterOptions, dryRun: true });
    return { snapshot: snapshotMemoryWorkbook(result.workbook), receipt: result.receipt };
  },
  apply(plan, workbook, adapterOptions) {
    const result = executeInMemory(plan, workbook, { ...adapterOptions, dryRun: false });
    return { snapshot: snapshotMemoryWorkbook(result.workbook), receipt: result.receipt };
  },
};
