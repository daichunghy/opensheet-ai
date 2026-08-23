import { projectMemoryWorkbook, type MemoryWorkbook } from "../adapters/memory.js";
import { digestJson } from "./canonical.js";
import { compilePlan } from "./plan.js";
import type { ExecutionReceipt, PolicyFinding, SheetPlan } from "./types.js";

export interface ReceiptVerificationInput {
  readonly receipt: ExecutionReceipt;
  readonly plan: SheetPlan;
  readonly beforeWorkbook: MemoryWorkbook;
  readonly afterWorkbook: MemoryWorkbook;
  readonly dryRun?: boolean;
}

export interface ReceiptVerificationResult {
  readonly status: "pass" | "fail";
  readonly findings: readonly PolicyFinding[];
}

function finding(code: string, message: string): PolicyFinding {
  return { code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function verifyReceipt(input: ReceiptVerificationInput): ReceiptVerificationResult {
  const findings: PolicyFinding[] = [];
  const { receipt, plan, beforeWorkbook, afterWorkbook } = input;
  const compiled = compilePlan(plan);
  // Memory adapter state digest is digestJson(workbook), not the normalized snapshot digest.
  const beforeDigest = digestJson(beforeWorkbook);
  const afterDigest = digestJson(afterWorkbook);

  if (!isRecord(receipt) || receipt.schemaVersion !== "opensheet.receipt.v1") {
    findings.push(
      finding("receipt_schema_invalid", "Receipt schemaVersion must equal opensheet.receipt.v1."),
    );
  }

  if (receipt.planDigest !== compiled.digest) {
    findings.push(
      finding("plan_digest_mismatch", "Receipt planDigest does not match the compiled plan digest."),
    );
  }

  if (receipt.beforeDigest !== beforeDigest) {
    findings.push(
      finding(
        "before_digest_mismatch",
        "Receipt beforeDigest does not match digestJson(beforeWorkbook).",
      ),
    );
  }

  if (input.dryRun === true && receipt.status !== "dry-run") {
    findings.push(finding("receipt_status_mismatch", "Receipt status must be dry-run when dryRun is true."));
  }
  if (input.dryRun === false && receipt.status === "dry-run") {
    findings.push(
      finding("receipt_status_mismatch", "Receipt status must not be dry-run when dryRun is false."),
    );
  }

  if (receipt.status === "dry-run") {
    if (receipt.afterDigest !== receipt.beforeDigest) {
      findings.push(
        finding("after_digest_mismatch", "Dry-run receipts must keep afterDigest equal to beforeDigest."),
      );
    }
    if (receipt.afterDigest !== afterDigest) {
      findings.push(
        finding("after_digest_mismatch", "Dry-run afterWorkbook digest must equal the receipt afterDigest."),
      );
    }
    if (afterDigest !== beforeDigest) {
      findings.push(finding("workbook_mutated", "Dry-run afterWorkbook must equal the before workbook."));
    }
    const expectedProjected = digestJson(projectMemoryWorkbook(plan, beforeWorkbook));
    if (receipt.projectedAfterDigest === undefined) {
      findings.push(
        finding(
          "projected_digest_mismatch",
          "Dry-run receipts must include projectedAfterDigest.",
        ),
      );
    } else if (receipt.projectedAfterDigest !== expectedProjected) {
      findings.push(
        finding(
          "projected_digest_mismatch",
          "Receipt projectedAfterDigest does not match the projected workbook digest.",
        ),
      );
    }
  }

  if (receipt.status === "applied") {
    if (receipt.afterDigest !== afterDigest) {
      findings.push(
        finding("after_digest_mismatch", "Applied receipts must match digestJson(afterWorkbook)."),
      );
    }
  }

  if (receipt.status === "blocked") {
    if (receipt.afterDigest !== receipt.beforeDigest) {
      findings.push(
        finding("after_digest_mismatch", "Blocked receipts must keep afterDigest equal to beforeDigest."),
      );
    }
    if (afterDigest !== beforeDigest) {
      findings.push(finding("workbook_mutated", "Blocked afterWorkbook must equal the before workbook."));
    }
  }

  return {
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  };
}
