import { parseA1Range } from "./range.js";
import type {
  CellFormat,
  CellValue,
  SheetOperation,
  SheetPlan,
  ValidationRule,
} from "./types.js";

export class PlanValidationError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super(`Invalid OpenSheet-AI plan:\n- ${issues.join("\n- ")}`);
    this.name = "PlanValidationError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCellValue(value: unknown): value is CellValue {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function validateAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
  issues: string[],
): void {
  const allowed = new Set(allowedKeys);
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) {
      issues.push(`${path} contains unsupported property '${key}'.`);
    }
  });
}

function validateIdentifier(value: unknown, path: string, issues: string[]): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 120) {
    issues.push(`${path} must be a string from 1 to 120 characters.`);
    return false;
  }
  return true;
}

function validateSheetName(value: unknown, path: string, issues: string[]): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 100) {
    issues.push(`${path} must be a string from 1 to 100 characters.`);
    return false;
  }
  if (/[\[\]:*?/\\]/.test(value)) {
    issues.push(`${path} contains a character that spreadsheet adapters cannot safely map.`);
    return false;
  }
  return true;
}

function validateMatrix(
  value: unknown,
  path: string,
  range: unknown,
  issues: string[],
  formulaMode: boolean,
): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(`${path} must be a non-empty two-dimensional array.`);
    return;
  }

  let expectedColumns: number | undefined;
  value.forEach((row, rowIndex) => {
    if (!Array.isArray(row) || row.length === 0) {
      issues.push(`${path}[${rowIndex}] must be a non-empty array.`);
      return;
    }

    expectedColumns ??= row.length;
    if (row.length !== expectedColumns) {
      issues.push(`${path} must be rectangular.`);
    }

    row.forEach((item, columnIndex) => {
      if (formulaMode) {
        if (typeof item !== "string" || !item.startsWith("=")) {
          issues.push(`${path}[${rowIndex}][${columnIndex}] must be an explicit formula beginning with '='.`);
        }
      } else if (!isCellValue(item) || (typeof item === "number" && !Number.isFinite(item))) {
        issues.push(`${path}[${rowIndex}][${columnIndex}] is not a finite JSON cell value.`);
      }
    });
  });

  if (typeof range === "string" && expectedColumns !== undefined) {
    try {
      const parsed = parseA1Range(range);
      if (parsed.rowCount !== value.length || parsed.columnCount !== expectedColumns) {
        issues.push(
          `${path} dimensions ${value.length}x${expectedColumns} do not match range ${parsed.normalized} (${parsed.rowCount}x${parsed.columnCount}).`,
        );
      }
    } catch (error) {
      issues.push(error instanceof Error ? error.message : `Invalid range at ${path}.`);
    }
  }
}

function validateRule(value: unknown, path: string, issues: string[]): value is ValidationRule {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return false;
  }

  if (typeof value["allowBlank"] !== "boolean") {
    issues.push(`${path}.allowBlank must be a boolean.`);
  }

  if (value["kind"] === "list") {
    validateAllowedKeys(value, ["kind", "values", "allowBlank"], path, issues);
    const values = value["values"];
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      values.some(
        (item) => !isCellValue(item) || (typeof item === "number" && !Number.isFinite(item)),
      )
    ) {
      issues.push(`${path}.values must contain at least one JSON cell value.`);
    }
    return true;
  }

  if (value["kind"] === "number-between") {
    validateAllowedKeys(value, ["kind", "min", "max", "allowBlank"], path, issues);
    const min = value["min"];
    const max = value["max"];
    if (
      typeof min !== "number" ||
      typeof max !== "number" ||
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min > max
    ) {
      issues.push(`${path} requires finite min and max values where min <= max.`);
    }
    return true;
  }

  issues.push(`${path}.kind must be 'list' or 'number-between'.`);
  return false;
}

function validateFormat(value: unknown, path: string, issues: string[]): value is CellFormat {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    issues.push(`${path} must be a non-empty object.`);
    return false;
  }
  validateAllowedKeys(
    value,
    ["bold", "backgroundColor", "wrap", "horizontalAlignment"],
    path,
    issues,
  );
  if (value["bold"] !== undefined && typeof value["bold"] !== "boolean") {
    issues.push(`${path}.bold must be a boolean.`);
  }
  if (value["wrap"] !== undefined && typeof value["wrap"] !== "boolean") {
    issues.push(`${path}.wrap must be a boolean.`);
  }
  if (
    value["backgroundColor"] !== undefined &&
    (typeof value["backgroundColor"] !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(value["backgroundColor"]))
  ) {
    issues.push(`${path}.backgroundColor must be a six-digit hex color.`);
  }
  if (
    value["horizontalAlignment"] !== undefined &&
    !["left", "center", "right"].includes(String(value["horizontalAlignment"]))
  ) {
    issues.push(`${path}.horizontalAlignment must be left, center, or right.`);
  }
  return true;
}

function validateRange(value: unknown, path: string, issues: string[]): value is string {
  if (typeof value !== "string") {
    issues.push(`${path} must be an A1 range string.`);
    return false;
  }
  try {
    parseA1Range(value);
    return true;
  } catch (error) {
    issues.push(error instanceof Error ? error.message : `${path} is invalid.`);
    return false;
  }
}

function validateOperation(value: unknown, index: number, issues: string[]): value is SheetOperation {
  const path = `operations[${index}]`;
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return false;
  }

  validateIdentifier(value["id"], `${path}.id`, issues);
  validateSheetName(value["sheet"], `${path}.sheet`, issues);

  switch (value["kind"]) {
    case "ensure-sheet":
      validateAllowedKeys(value, ["id", "kind", "sheet"], path, issues);
      return true;
    case "write-range":
      validateAllowedKeys(value, ["id", "kind", "sheet", "range", "values"], path, issues);
      validateRange(value["range"], `${path}.range`, issues);
      validateMatrix(value["values"], `${path}.values`, value["range"], issues, false);
      return true;
    case "write-formulas":
      validateAllowedKeys(value, ["id", "kind", "sheet", "range", "formulas"], path, issues);
      validateRange(value["range"], `${path}.range`, issues);
      validateMatrix(value["formulas"], `${path}.formulas`, value["range"], issues, true);
      return true;
    case "set-data-validation":
      validateAllowedKeys(value, ["id", "kind", "sheet", "range", "rule"], path, issues);
      validateRange(value["range"], `${path}.range`, issues);
      validateRule(value["rule"], `${path}.rule`, issues);
      return true;
    case "set-format":
      validateAllowedKeys(value, ["id", "kind", "sheet", "range", "format"], path, issues);
      validateRange(value["range"], `${path}.range`, issues);
      validateFormat(value["format"], `${path}.format`, issues);
      return true;
    case "freeze-pane": {
      validateAllowedKeys(value, ["id", "kind", "sheet", "rows", "columns"], path, issues);
      const rows = value["rows"];
      const columns = value["columns"];
      if (!Number.isInteger(rows) || Number(rows) < 0 || Number(rows) > 100) {
        issues.push(`${path}.rows must be an integer from 0 to 100.`);
      }
      if (!Number.isInteger(columns) || Number(columns) < 0 || Number(columns) > 100) {
        issues.push(`${path}.columns must be an integer from 0 to 100.`);
      }
      return true;
    }
    case "set-column-widths": {
      validateAllowedKeys(value, ["id", "kind", "sheet", "widths"], path, issues);
      const widths = value["widths"];
      if (!Array.isArray(widths) || widths.length === 0) {
        issues.push(`${path}.widths must be a non-empty array.`);
        return true;
      }
      widths.forEach((entry, widthIndex) => {
        if (!isRecord(entry)) {
          issues.push(`${path}.widths[${widthIndex}] must be an object.`);
          return;
        }
        validateAllowedKeys(entry, ["column", "width"], `${path}.widths[${widthIndex}]`, issues);
        if (typeof entry["column"] !== "string" || !/^[A-Z]{1,3}$/.test(entry["column"])) {
          issues.push(`${path}.widths[${widthIndex}].column must be an uppercase column name.`);
        }
        if (
          typeof entry["width"] !== "number" ||
          !Number.isFinite(entry["width"]) ||
          entry["width"] < 1 ||
          entry["width"] > 400
        ) {
          issues.push(`${path}.widths[${widthIndex}].width must be from 1 to 400.`);
        }
      });
      return true;
    }
    default:
      issues.push(`${path}.kind is not supported by opensheet.plan.v1.`);
      return false;
  }
}

export function assertSheetPlan(value: unknown): asserts value is SheetPlan {
  const issues: string[] = [];
  if (!isRecord(value)) {
    throw new PlanValidationError(["Plan must be an object."]);
  }

  validateAllowedKeys(
    value,
    ["schemaVersion", "planId", "source", "target", "operations", "metadata"],
    "plan",
    issues,
  );

  if (value["schemaVersion"] !== "opensheet.plan.v1") {
    issues.push("schemaVersion must equal opensheet.plan.v1.");
  }
  validateIdentifier(value["planId"], "planId", issues);

  const source = value["source"];
  if (!isRecord(source)) {
    issues.push("source must be an object.");
  } else {
    validateAllowedKeys(source, ["module", "version"], "source", issues);
    validateIdentifier(source["module"], "source.module", issues);
    validateIdentifier(source["version"], "source.version", issues);
  }

  const target = value["target"];
  if (!isRecord(target)) {
    issues.push("target must be an object.");
  } else {
    validateAllowedKeys(target, ["workbook"], "target", issues);
    validateIdentifier(target["workbook"], "target.workbook", issues);
  }

  const operations = value["operations"];
  if (!Array.isArray(operations) || operations.length === 0) {
    issues.push("operations must be a non-empty array.");
  } else {
    operations.forEach((operation, index) => validateOperation(operation, index, issues));
    const ids = operations
      .filter(isRecord)
      .map((operation) => operation["id"])
      .filter((id): id is string => typeof id === "string");
    if (new Set(ids).size !== ids.length) {
      issues.push("operation ids must be unique within a plan.");
    }
  }

  const metadata = value["metadata"];
  if (!isRecord(metadata) || Object.values(metadata).some((item) => typeof item !== "string")) {
    issues.push("metadata must be an object with string values.");
  }

  if (issues.length > 0) {
    throw new PlanValidationError(issues);
  }
}
