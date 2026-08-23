import {
  ERROR_CODES,
  IntentValidationError,
  planIssue,
  type PlanIssue,
} from "../core/errors.js";
import { parseColumnName } from "../core/range.js";
import { validateSheetName } from "../core/validation.js";
import type { ExpectedConstruct, GapMapIntent, ObservedColumn } from "./gap-map.js";
import type { KpiThresholdIntent, KpiThresholdItem } from "./kpi-threshold.js";
import type { ScaleBankConstruct, ScaleBankIntent, ScaleBankItem } from "./scale-bank.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: PlanIssue[],
): void {
  const allowedSet = new Set(allowed);
  Object.keys(value).forEach((key) => {
    if (!allowedSet.has(key)) {
      issues.push(
        planIssue(
          ERROR_CODES.unsupported_property,
          `${path}.${key}`,
          `${path} contains unsupported property '${key}'.`,
        ),
      );
    }
  });
}

function requireText(value: unknown, path: string, issues: PlanIssue[], max = 500): value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    issues.push(
      planIssue(ERROR_CODES.invalid_identifier, path, `${path} must contain from 1 to ${max} characters.`),
    );
    return false;
  }
  return true;
}

function parseScaleItem(value: unknown, path: string, issues: PlanIssue[]): ScaleBankItem | undefined {
  if (!isRecord(value)) {
    issues.push(planIssue(ERROR_CODES.invalid_intent, path, `${path} must be an object.`));
    return undefined;
  }
  rejectUnknownKeys(value, ["code", "text", "reverse", "source"], path, issues);
  requireText(value["code"], `${path}.code`, issues);
  requireText(value["text"], `${path}.text`, issues);
  if (value["reverse"] !== undefined && typeof value["reverse"] !== "boolean") {
    issues.push(planIssue(ERROR_CODES.invalid_intent, `${path}.reverse`, `${path}.reverse must be a boolean.`));
  }
  if (value["source"] !== undefined) {
    requireText(value["source"], `${path}.source`, issues);
  }
  if (typeof value["code"] !== "string" || typeof value["text"] !== "string") {
    return undefined;
  }
  return {
    code: value["code"],
    text: value["text"],
    ...(typeof value["reverse"] === "boolean" ? { reverse: value["reverse"] } : {}),
    ...(typeof value["source"] === "string" ? { source: value["source"] } : {}),
  };
}

function parseScaleConstruct(
  value: unknown,
  path: string,
  issues: PlanIssue[],
): ScaleBankConstruct | undefined {
  if (!isRecord(value)) {
    issues.push(planIssue(ERROR_CODES.invalid_intent, path, `${path} must be an object.`));
    return undefined;
  }
  rejectUnknownKeys(value, ["code", "name", "scale", "items"], path, issues);
  requireText(value["code"], `${path}.code`, issues);
  requireText(value["name"], `${path}.name`, issues);
  const scale = value["scale"];
  if (!isRecord(scale)) {
    issues.push(planIssue(ERROR_CODES.invalid_scale, `${path}.scale`, `${path}.scale must be an object.`));
  } else {
    rejectUnknownKeys(scale, ["min", "max"], `${path}.scale`, issues);
    if (
      !Number.isInteger(scale["min"]) ||
      !Number.isInteger(scale["max"]) ||
      Number(scale["min"]) >= Number(scale["max"])
    ) {
      issues.push(
        planIssue(
          ERROR_CODES.invalid_scale,
          `${path}.scale`,
          `Construct ${String(value["code"] ?? path)} requires integer scale bounds where min < max.`,
        ),
      );
    }
  }
  const items = value["items"];
  if (!Array.isArray(items) || items.length === 0) {
    issues.push(
      planIssue(
        ERROR_CODES.empty_collection,
        `${path}.items`,
        `Construct ${String(value["code"] ?? path)} requires at least one item.`,
      ),
    );
    return undefined;
  }
  const parsedItems = items
    .map((item, index) => parseScaleItem(item, `${path}.items[${index}]`, issues))
    .filter((item): item is ScaleBankItem => item !== undefined);
  if (typeof value["code"] !== "string" || typeof value["name"] !== "string" || !isRecord(scale)) {
    return undefined;
  }
  return {
    code: value["code"],
    name: value["name"],
    scale: { min: Number(scale["min"]), max: Number(scale["max"]) },
    items: parsedItems,
  };
}

export function parseScaleBankIntent(value: unknown): ScaleBankIntent {
  const issues: PlanIssue[] = [];
  if (!isRecord(value)) {
    throw new IntentValidationError([
      planIssue(ERROR_CODES.invalid_intent, "intent", "Intent must be an object."),
    ]);
  }
  rejectUnknownKeys(value, ["module", "version", "workbook", "sheetName", "constructs"], "intent", issues);
  if (value["module"] !== "scale-bank" || value["version"] !== 1) {
    issues.push(
      planIssue(
        ERROR_CODES.invalid_intent,
        "intent.module",
        "Scale bank intent must use module 'scale-bank' and version 1.",
      ),
    );
  }
  requireText(value["workbook"], "workbook", issues);
  if (value["sheetName"] !== undefined) {
    validateSheetName(value["sheetName"], "sheetName", issues);
  }
  const constructs = value["constructs"];
  if (!Array.isArray(constructs) || constructs.length === 0) {
    issues.push(
      planIssue(ERROR_CODES.empty_collection, "constructs", "Scale bank intent requires at least one construct."),
    );
  }
  const parsedConstructs = Array.isArray(constructs)
    ? constructs
        .map((construct, index) => parseScaleConstruct(construct, `constructs[${index}]`, issues))
        .filter((construct): construct is ScaleBankConstruct => construct !== undefined)
    : [];

  const constructCodes = new Set<string>();
  const itemCodes = new Set<string>();
  parsedConstructs.forEach((construct) => {
    if (constructCodes.has(construct.code)) {
      issues.push(
        planIssue(
          ERROR_CODES.duplicate_code,
          "constructs",
          `Duplicate construct code: ${construct.code}`,
        ),
      );
    }
    constructCodes.add(construct.code);
    construct.items.forEach((item) => {
      if (itemCodes.has(item.code)) {
        issues.push(planIssue(ERROR_CODES.duplicate_code, "constructs", `Duplicate scale item code: ${item.code}`));
      }
      itemCodes.add(item.code);
    });
  });

  if (issues.length > 0) {
    throw new IntentValidationError(issues);
  }
  if (typeof value["workbook"] !== "string") {
    throw new IntentValidationError([
      planIssue(ERROR_CODES.missing_field, "workbook", "workbook must contain from 1 to 500 characters."),
    ]);
  }
  return {
    module: "scale-bank",
    version: 1,
    workbook: value["workbook"],
    ...(typeof value["sheetName"] === "string" ? { sheetName: value["sheetName"] } : {}),
    constructs: parsedConstructs,
  };
}

function parseExpectedConstruct(value: unknown, path: string, issues: PlanIssue[]): ExpectedConstruct | undefined {
  if (!isRecord(value)) {
    issues.push(planIssue(ERROR_CODES.invalid_intent, path, `${path} must be an object.`));
    return undefined;
  }
  rejectUnknownKeys(value, ["code", "name", "minimumItems"], path, issues);
  requireText(value["code"], `${path}.code`, issues);
  requireText(value["name"], `${path}.name`, issues);
  if (!Number.isInteger(value["minimumItems"]) || Number(value["minimumItems"]) < 1) {
    issues.push(
      planIssue(
        ERROR_CODES.invalid_intent,
        `${path}.minimumItems`,
        `Construct ${String(value["code"] ?? path)} requires minimumItems >= 1.`,
      ),
    );
  }
  if (typeof value["code"] !== "string" || typeof value["name"] !== "string") {
    return undefined;
  }
  return {
    code: value["code"],
    name: value["name"],
    minimumItems: Number(value["minimumItems"]),
  };
}

function parseObservedColumn(value: unknown, path: string, issues: PlanIssue[]): ObservedColumn | undefined {
  if (!isRecord(value)) {
    issues.push(planIssue(ERROR_CODES.invalid_intent, path, `${path} must be an object.`));
    return undefined;
  }
  rejectUnknownKeys(value, ["column", "constructCode", "itemCode"], path, issues);
  if (typeof value["column"] !== "string") {
    issues.push(
      planIssue(
        ERROR_CODES.invalid_column_width,
        `${path}.column`,
        `Observed column must be an Excel-compatible uppercase A1 column name.`,
      ),
    );
  } else {
    try {
      parseColumnName(value["column"]);
    } catch {
      issues.push(
        planIssue(
          ERROR_CODES.invalid_column_width,
          `${path}.column`,
          `Observed column '${value["column"]}' must be an Excel-compatible uppercase A1 column name.`,
        ),
      );
    }
  }
  requireText(value["constructCode"], `${path}.constructCode`, issues);
  requireText(value["itemCode"], `${path}.itemCode`, issues);
  if (
    typeof value["column"] !== "string" ||
    typeof value["constructCode"] !== "string" ||
    typeof value["itemCode"] !== "string"
  ) {
    return undefined;
  }
  return {
    column: value["column"],
    constructCode: value["constructCode"],
    itemCode: value["itemCode"],
  };
}

export function parseGapMapIntent(value: unknown): GapMapIntent {
  const issues: PlanIssue[] = [];
  if (!isRecord(value)) {
    throw new IntentValidationError([
      planIssue(ERROR_CODES.invalid_intent, "intent", "Intent must be an object."),
    ]);
  }
  rejectUnknownKeys(
    value,
    ["module", "version", "workbook", "sheetName", "expected", "observed"],
    "intent",
    issues,
  );
  if (value["module"] !== "gap-map" || value["version"] !== 1) {
    issues.push(
      planIssue(
        ERROR_CODES.invalid_intent,
        "intent.module",
        "Gap map intent must use module 'gap-map' and version 1.",
      ),
    );
  }
  requireText(value["workbook"], "workbook", issues);
  if (value["sheetName"] !== undefined) {
    validateSheetName(value["sheetName"], "sheetName", issues);
  }
  const expected = value["expected"];
  if (!Array.isArray(expected) || expected.length === 0) {
    issues.push(
      planIssue(ERROR_CODES.empty_collection, "expected", "Gap map intent requires at least one expected construct."),
    );
  }
  const observed = value["observed"];
  if (observed !== undefined && !Array.isArray(observed)) {
    issues.push(planIssue(ERROR_CODES.invalid_intent, "observed", "observed must be an array."));
  }
  const parsedExpected = Array.isArray(expected)
    ? expected
        .map((construct, index) => parseExpectedConstruct(construct, `expected[${index}]`, issues))
        .filter((construct): construct is ExpectedConstruct => construct !== undefined)
    : [];
  const parsedObserved = Array.isArray(observed)
    ? observed
        .map((column, index) => parseObservedColumn(column, `observed[${index}]`, issues))
        .filter((column): column is ObservedColumn => column !== undefined)
    : [];

  const expectedCodes = new Set<string>();
  parsedExpected.forEach((construct) => {
    if (expectedCodes.has(construct.code)) {
      issues.push(
        planIssue(
          ERROR_CODES.duplicate_code,
          "expected",
          `Duplicate expected construct code: ${construct.code}`,
        ),
      );
    }
    expectedCodes.add(construct.code);
  });
  const observedColumns = new Set<string>();
  parsedObserved.forEach((column) => {
    if (observedColumns.has(column.column)) {
      issues.push(
        planIssue(ERROR_CODES.duplicate_code, "observed", `Observed column appears more than once: ${column.column}`),
      );
    }
    observedColumns.add(column.column);
  });

  if (issues.length > 0) {
    throw new IntentValidationError(issues);
  }
  if (typeof value["workbook"] !== "string") {
    throw new IntentValidationError([
      planIssue(ERROR_CODES.missing_field, "workbook", "workbook must contain from 1 to 500 characters."),
    ]);
  }
  return {
    module: "gap-map",
    version: 1,
    workbook: value["workbook"],
    ...(typeof value["sheetName"] === "string" ? { sheetName: value["sheetName"] } : {}),
    expected: parsedExpected,
    observed: parsedObserved,
  };
}

function parseKpiItem(value: unknown, path: string, issues: PlanIssue[]): KpiThresholdItem | undefined {
  if (!isRecord(value)) {
    issues.push(planIssue(ERROR_CODES.invalid_intent, path, `${path} must be an object.`));
    return undefined;
  }
  rejectUnknownKeys(value, ["code", "name", "actual", "target", "warnBelow", "unit"], path, issues);
  requireText(value["code"], `${path}.code`, issues);
  requireText(value["name"], `${path}.name`, issues);
  if (typeof value["actual"] !== "number" || !Number.isFinite(value["actual"])) {
    issues.push(planIssue(ERROR_CODES.invalid_intent, `${path}.actual`, `${path}.actual must be a finite number.`));
  }
  if (typeof value["target"] !== "number" || !Number.isFinite(value["target"])) {
    issues.push(planIssue(ERROR_CODES.invalid_intent, `${path}.target`, `${path}.target must be a finite number.`));
  }
  if (value["warnBelow"] !== undefined && (typeof value["warnBelow"] !== "number" || !Number.isFinite(value["warnBelow"]))) {
    issues.push(
      planIssue(ERROR_CODES.invalid_intent, `${path}.warnBelow`, `${path}.warnBelow must be a finite number.`),
    );
  }
  if (
    typeof value["warnBelow"] === "number" &&
    typeof value["target"] === "number" &&
    value["warnBelow"] > value["target"]
  ) {
    issues.push(
      planIssue(ERROR_CODES.invalid_scale, `${path}.warnBelow`, `${path}.warnBelow must be less than or equal to target.`),
    );
  }
  if (value["unit"] !== undefined) {
    requireText(value["unit"], `${path}.unit`, issues, 40);
  }
  if (typeof value["code"] !== "string" || typeof value["name"] !== "string") {
    return undefined;
  }
  if (typeof value["actual"] !== "number" || typeof value["target"] !== "number") {
    return undefined;
  }
  return {
    code: value["code"],
    name: value["name"],
    actual: value["actual"],
    target: value["target"],
    ...(typeof value["warnBelow"] === "number" ? { warnBelow: value["warnBelow"] } : {}),
    ...(typeof value["unit"] === "string" ? { unit: value["unit"] } : {}),
  };
}

export function parseKpiThresholdIntent(value: unknown): KpiThresholdIntent {
  const issues: PlanIssue[] = [];
  if (!isRecord(value)) {
    throw new IntentValidationError([
      planIssue(ERROR_CODES.invalid_intent, "intent", "Intent must be an object."),
    ]);
  }
  rejectUnknownKeys(value, ["module", "version", "workbook", "sheetName", "kpis"], "intent", issues);
  if (value["module"] !== "kpi-threshold" || value["version"] !== 1) {
    issues.push(
      planIssue(
        ERROR_CODES.invalid_intent,
        "intent.module",
        "KPI threshold intent must use module 'kpi-threshold' and version 1.",
      ),
    );
  }
  requireText(value["workbook"], "workbook", issues);
  if (value["sheetName"] !== undefined) {
    validateSheetName(value["sheetName"], "sheetName", issues);
  }
  const kpis = value["kpis"];
  if (!Array.isArray(kpis) || kpis.length === 0) {
    issues.push(planIssue(ERROR_CODES.empty_collection, "kpis", "KPI threshold intent requires at least one KPI."));
  }
  const parsedKpis = Array.isArray(kpis)
    ? kpis
        .map((item, index) => parseKpiItem(item, `kpis[${index}]`, issues))
        .filter((item): item is KpiThresholdItem => item !== undefined)
    : [];
  const codes = new Set<string>();
  parsedKpis.forEach((item) => {
    if (codes.has(item.code)) {
      issues.push(planIssue(ERROR_CODES.duplicate_code, "kpis", `Duplicate KPI code: ${item.code}`));
    }
    codes.add(item.code);
  });
  if (issues.length > 0) {
    throw new IntentValidationError(issues);
  }
  if (typeof value["workbook"] !== "string") {
    throw new IntentValidationError([
      planIssue(ERROR_CODES.missing_field, "workbook", "workbook must contain from 1 to 500 characters."),
    ]);
  }
  return {
    module: "kpi-threshold",
    version: 1,
    workbook: value["workbook"],
    ...(typeof value["sheetName"] === "string" ? { sheetName: value["sheetName"] } : {}),
    kpis: parsedKpis,
  };
}
