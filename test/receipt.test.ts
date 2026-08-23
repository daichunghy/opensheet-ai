import { describe, expect, it } from "vitest";
import { createEmptyWorkbook, executeInMemory } from "../src/adapters/memory.js";
import { verifyReceipt } from "../src/core/receipt.js";
import type { ExecutionReceipt } from "../src/core/types.js";
import { basePlan } from "./helpers.js";

const fixedNow = (): string => "2026-08-22T00:00:00.000Z";

describe("receipt verification", () => {
  it("passes a dry-run receipt against the caller workbook", () => {
    const before = createEmptyWorkbook("test-workbook");
    const result = executeInMemory(basePlan(), before, { dryRun: true, now: fixedNow });
    expect(
      verifyReceipt({
        receipt: result.receipt,
        plan: basePlan(),
        beforeWorkbook: before,
        afterWorkbook: result.workbook,
        dryRun: true,
      }),
    ).toEqual({ status: "pass", findings: [] });
  });

  it("passes an applied receipt against before and after workbooks", () => {
    const before = createEmptyWorkbook("test-workbook");
    const result = executeInMemory(basePlan(), before, { dryRun: false, now: fixedNow });
    expect(
      verifyReceipt({
        receipt: result.receipt,
        plan: basePlan(),
        beforeWorkbook: before,
        afterWorkbook: result.workbook,
        dryRun: false,
      }),
    ).toEqual({ status: "pass", findings: [] });
  });

  it("fails when planDigest is tampered", () => {
    const before = createEmptyWorkbook("test-workbook");
    const result = executeInMemory(basePlan(), before, { dryRun: true, now: fixedNow });
    const tampered: ExecutionReceipt = {
      ...result.receipt,
      planDigest: `sha256:${"a".repeat(64)}`,
    };
    const verification = verifyReceipt({
      receipt: tampered,
      plan: basePlan(),
      beforeWorkbook: before,
      afterWorkbook: result.workbook,
      dryRun: true,
    });
    expect(verification.status).toBe("fail");
    expect(verification.findings.map((finding) => finding.code)).toContain("plan_digest_mismatch");
  });

  it("fails when afterDigest is swapped", () => {
    const before = createEmptyWorkbook("test-workbook");
    const result = executeInMemory(basePlan(), before, { dryRun: false, now: fixedNow });
    const tampered: ExecutionReceipt = {
      ...result.receipt,
      afterDigest: result.receipt.beforeDigest,
    };
    const verification = verifyReceipt({
      receipt: tampered,
      plan: basePlan(),
      beforeWorkbook: before,
      afterWorkbook: result.workbook,
      dryRun: false,
    });
    expect(verification.status).toBe("fail");
    expect(verification.findings.map((finding) => finding.code)).toContain("after_digest_mismatch");
  });

  it("fails when projectedAfterDigest is dropped from a dry-run receipt", () => {
    const before = createEmptyWorkbook("test-workbook");
    const result = executeInMemory(basePlan(), before, { dryRun: true, now: fixedNow });
    const { projectedAfterDigest: _dropped, ...rest } = result.receipt;
    const tampered = rest as ExecutionReceipt;
    const verification = verifyReceipt({
      receipt: tampered,
      plan: basePlan(),
      beforeWorkbook: before,
      afterWorkbook: result.workbook,
      dryRun: true,
    });
    expect(verification.status).toBe("fail");
    expect(verification.findings.map((finding) => finding.code)).toContain("projected_digest_mismatch");
  });
});
