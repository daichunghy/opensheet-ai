import { describe, expect, it } from "vitest";
import { createEmptyWorkbook, executeInMemory } from "../src/adapters/memory.js";
import { digestJson } from "../src/core/canonical.js";
import { digestRangeState } from "../src/core/preconditions.js";
import { basePlan } from "./helpers.js";

const fixedNow = (): string => "2026-08-22T00:00:00.000Z";

describe("operation preconditions", () => {
  it("blocks when a required sheet is missing", () => {
    const workbook = createEmptyWorkbook("test-workbook");
    const original = JSON.stringify(workbook);
    const result = executeInMemory(basePlan(), workbook, {
      dryRun: false,
      now: fixedNow,
      preconditions: { sheetsMustExist: ["Data"] },
    });
    expect(result.receipt.status).toBe("blocked");
    expect(result.receipt.findings[0]).toMatchObject({
      code: "precondition_mismatch",
    });
    expect(result.receipt.findings[0]?.message).toMatch(/sheetsMustExist/);
    expect(result.receipt.afterDigest).toBe(result.receipt.beforeDigest);
    expect(JSON.stringify(workbook)).toBe(original);
    expect(result.workbook.sheets).toEqual({});
  });

  it("blocks when the workbook digest does not match", () => {
    const workbook = createEmptyWorkbook("test-workbook");
    const result = executeInMemory(basePlan(), workbook, {
      dryRun: false,
      now: fixedNow,
      preconditions: { workbookDigest: `sha256:${"0".repeat(64)}` },
    });
    expect(result.receipt.status).toBe("blocked");
    expect(result.receipt.findings.map((finding) => finding.code)).toEqual(["precondition_mismatch"]);
    expect(result.workbook.sheets).toEqual({});
  });

  it("applies when the workbook digest matches", () => {
    const workbook = createEmptyWorkbook("test-workbook");
    const result = executeInMemory(basePlan(), workbook, {
      dryRun: false,
      now: fixedNow,
      preconditions: { workbookDigest: digestJson(workbook) },
    });
    expect(result.receipt.status).toBe("applied");
    expect(result.workbook.sheets["Data"]?.cells["A2"]).toEqual({ kind: "value", value: "A" });
  });

  it("accepts a matching range digest and rejects a drifted one", () => {
    const first = executeInMemory(basePlan(), createEmptyWorkbook("test-workbook"), {
      dryRun: false,
      now: fixedNow,
    });
    const digest = digestRangeState(first.workbook, "Data", "A1:B2");
    const matching = executeInMemory(basePlan(), first.workbook, {
      dryRun: false,
      now: fixedNow,
      preconditions: { rangeDigests: [{ sheet: "Data", range: "A1:B2", digest }] },
    });
    expect(matching.receipt.status).toBe("applied");

    const drifted = {
      ...first.workbook,
      sheets: {
        Data: {
          ...first.workbook.sheets["Data"]!,
          cells: {
            ...first.workbook.sheets["Data"]!.cells,
            A1: { kind: "value" as const, value: "Changed" },
          },
        },
      },
    };
    const mismatch = executeInMemory(basePlan(), drifted, {
      dryRun: false,
      now: fixedNow,
      preconditions: { rangeDigests: [{ sheet: "Data", range: "A1:B2", digest }] },
    });
    expect(mismatch.receipt.status).toBe("blocked");
    expect(mismatch.receipt.findings[0]?.code).toBe("precondition_mismatch");
    expect(mismatch.workbook.sheets["Data"]?.cells["A1"]).toEqual({ kind: "value", value: "Changed" });
  });
});
