import { describe, expect, it } from "vitest";
import { createEmptyWorkbook, executeInMemory } from "../src/adapters/memory.js";
import type { SheetPlan } from "../src/core/types.js";
import { basePlan } from "./helpers.js";

const fixedNow = (): string => "2026-08-22T00:00:00.000Z";

describe("in-memory adapter", () => {
  it("previews without mutating caller-owned state", () => {
    const workbook = createEmptyWorkbook("test-workbook");
    const original = JSON.stringify(workbook);
    const result = executeInMemory(basePlan(), workbook, { dryRun: true, now: fixedNow });
    expect(result.receipt.status).toBe("dry-run");
    expect(result.receipt.afterDigest).toBe(result.receipt.beforeDigest);
    expect(result.receipt.projectedAfterDigest).not.toBe(result.receipt.beforeDigest);
    expect(JSON.stringify(workbook)).toBe(original);
    expect(result.workbook).toEqual(workbook);
  });

  it("applies a validated plan to a cloned workbook", () => {
    const workbook = createEmptyWorkbook("test-workbook");
    const result = executeInMemory(basePlan(), workbook, { dryRun: false, now: fixedNow });
    expect(result.receipt.status).toBe("applied");
    expect(result.workbook.sheets["Data"]?.cells["A2"]).toEqual({ kind: "value", value: "A" });
    expect(workbook.sheets["Data"]).toBeUndefined();
  });

  it("does not execute a policy-blocked plan", () => {
    const plan: SheetPlan = {
      ...basePlan(),
      operations: [
        { id: "ensure", kind: "ensure-sheet", sheet: "Data" },
        {
          id: "formula",
          kind: "write-formulas",
          sheet: "Data",
          range: "A1",
          formulas: [["=1+1"]],
        },
      ],
    };
    const result = executeInMemory(plan, createEmptyWorkbook("test-workbook"), {
      dryRun: false,
      now: fixedNow,
    });
    expect(result.receipt.status).toBe("blocked");
    expect(result.workbook.sheets).toEqual({});
  });
});
