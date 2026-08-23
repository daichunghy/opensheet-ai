import { digestJson } from "./canonical.js";
import { rangeCellPayload, type SnapshotSourceWorkbook } from "./snapshot.js";
import type { PolicyDecision, PolicyFinding, SheetPlan } from "./types.js";

export interface RangeStateDigest {
  readonly sheet: string;
  readonly range: string;
  readonly digest: string;
}

export interface PlanPreconditions {
  readonly workbookDigest?: string;
  readonly sheetsMustExist?: readonly string[];
  readonly sheetsMustNotExist?: readonly string[];
  readonly rangeDigests?: readonly RangeStateDigest[];
}

export function digestRangeState(
  workbook: SnapshotSourceWorkbook,
  sheet: string,
  range: string,
): string {
  return digestJson(rangeCellPayload(workbook, sheet, range));
}

export function evaluatePreconditions(
  workbook: SnapshotSourceWorkbook,
  preconditions: PlanPreconditions,
): PolicyDecision {
  const findings: PolicyFinding[] = [];

  if (
    preconditions.workbookDigest !== undefined &&
    preconditions.workbookDigest !== digestJson(workbook)
  ) {
    findings.push({
      code: "precondition_mismatch",
      message: "preconditions.workbookDigest does not match the current workbook state.",
    });
  }

  preconditions.sheetsMustExist?.forEach((sheet, index) => {
    if (workbook.sheets[sheet] === undefined) {
      findings.push({
        code: "precondition_mismatch",
        message: `preconditions.sheetsMustExist[${index}]: sheet '${sheet}' is missing.`,
      });
    }
  });

  preconditions.sheetsMustNotExist?.forEach((sheet, index) => {
    if (workbook.sheets[sheet] !== undefined) {
      findings.push({
        code: "precondition_mismatch",
        message: `preconditions.sheetsMustNotExist[${index}]: sheet '${sheet}' already exists.`,
      });
    }
  });

  preconditions.rangeDigests?.forEach((entry, index) => {
    const actual = digestRangeState(workbook, entry.sheet, entry.range);
    if (actual !== entry.digest) {
      findings.push({
        code: "precondition_mismatch",
        message: `preconditions.rangeDigests[${index}]: ${entry.sheet}!${entry.range} does not match the declared digest.`,
      });
    }
  });

  return {
    status: findings.length === 0 ? "pass" : "blocked",
    findings,
  };
}

export function evaluateWorkbookBinding(
  plan: SheetPlan,
  workbook: SnapshotSourceWorkbook,
): PolicyDecision {
  if (workbook.id === plan.target.workbook) {
    return { status: "pass", findings: [] };
  }
  return {
    status: "blocked",
    findings: [
      {
        code: "workbook_identity_mismatch",
        message: `Plan target workbook '${plan.target.workbook}' does not match adapter workbook '${workbook.id}'.`,
      },
    ],
  };
}

export function preflightSheetTargets(
  plan: SheetPlan,
  workbook: SnapshotSourceWorkbook,
): PolicyDecision {
  const sheets = new Set(Object.keys(workbook.sheets));
  const findings: PolicyFinding[] = [];

  for (const operation of plan.operations) {
    if (operation.kind === "ensure-sheet") {
      sheets.add(operation.sheet);
      continue;
    }
    if (!sheets.has(operation.sheet)) {
      findings.push({
        code: "missing_sheet",
        message: `Operation '${operation.id}' targets sheet '${operation.sheet}' which does not exist and is not created earlier in the plan.`,
        operationId: operation.id,
      });
    }
  }

  return {
    status: findings.length === 0 ? "pass" : "blocked",
    findings,
  };
}
