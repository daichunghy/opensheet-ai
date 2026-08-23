import { describe, expect, it } from "vitest";
import { createEmptyWorkbook, executeInMemory } from "../src/adapters/memory.js";
import { basePlan } from "./helpers.js";

const fixedNow = (): string => "2026-08-22T00:00:00.000Z";

describe("idempotent replay", () => {
  it("replays an applied receipt as a no-op when the workbook is unchanged", () => {
    const first = executeInMemory(basePlan(), createEmptyWorkbook("test-workbook"), {
      dryRun: false,
      now: fixedNow,
    });
    const original = JSON.stringify(first.workbook);
    const second = executeInMemory(basePlan(), first.workbook, {
      dryRun: false,
      now: fixedNow,
      previousReceipt: first.receipt,
    });
    expect(second.receipt.status).toBe("applied");
    expect(second.receipt.findings).toEqual([
      {
        code: "idempotent_replay",
        message: "Plan was already applied to this workbook state; execution was a no-op.",
      },
    ]);
    expect(second.receipt.afterDigest).toBe(second.receipt.beforeDigest);
    expect(second.receipt.operations.every((operation) => operation.status === "applied")).toBe(true);
    expect(JSON.stringify(first.workbook)).toBe(original);
    expect(second.workbook).toEqual(first.workbook);
  });

  it("still writes when the same plan is applied without previousReceipt", () => {
    const first = executeInMemory(basePlan(), createEmptyWorkbook("test-workbook"), {
      dryRun: false,
      now: fixedNow,
    });
    const second = executeInMemory(basePlan(), first.workbook, {
      dryRun: false,
      now: fixedNow,
    });
    expect(second.receipt.status).toBe("applied");
    expect(second.receipt.findings).toEqual([]);
    expect(second.workbook.sheets["Data"]?.cells["A2"]).toEqual({ kind: "value", value: "A" });
  });

  it("does not short-circuit when the workbook has drifted", () => {
    const first = executeInMemory(basePlan(), createEmptyWorkbook("test-workbook"), {
      dryRun: false,
      now: fixedNow,
    });
    const data = first.workbook.sheets["Data"];
    if (!data) {
      throw new Error("expected Data sheet");
    }
    const drifted = {
      ...first.workbook,
      sheets: {
        Data: {
          ...data,
          cells: {
            ...data.cells,
            Z9: { kind: "value" as const, value: "drift" },
          },
        },
      },
    };
    const second = executeInMemory(basePlan(), drifted, {
      dryRun: false,
      now: fixedNow,
      previousReceipt: first.receipt,
    });
    expect(second.receipt.findings.map((finding) => finding.code)).not.toContain("idempotent_replay");
    expect(second.receipt.status).toBe("applied");
    expect(second.workbook.sheets["Data"]?.cells["Z9"]).toEqual({ kind: "value", value: "drift" });
    expect(second.workbook.sheets["Data"]?.cells["A2"]).toEqual({ kind: "value", value: "A" });
  });
});
