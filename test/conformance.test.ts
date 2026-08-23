import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createEmptyWorkbook, executeInMemory } from "../src/adapters/memory.js";
import { digestJson } from "../src/core/canonical.js";
import { compilePlan } from "../src/core/plan.js";
import { DEFAULT_POLICY } from "../src/core/policy.js";
import type { SheetPlan } from "../src/core/types.js";
import { PlanValidationError } from "../src/core/validation.js";
import { compileGapMap, type GapMapIntent } from "../src/modules/gap-map.js";
import { compileScaleBank, type ScaleBankIntent } from "../src/modules/scale-bank.js";
import { basePlan } from "./helpers.js";

const fixedNow = (): string => "2026-08-22T00:00:00.000Z";

async function readExample(name: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(`../examples/${name}`, import.meta.url), "utf8")) as unknown;
}

describe("F1 conformance", () => {
  it("compiles both shipped example intents", async () => {
    const scale = compileScaleBank((await readExample("scale-bank.json")) as ScaleBankIntent);
    const gap = compileGapMap((await readExample("gap-map.json")) as GapMapIntent);
    expect(scale.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(gap.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(scale.plan.operations.some((operation) => operation.kind === "write-range")).toBe(true);
    expect(gap.plan.operations.some((operation) => operation.kind === "write-range")).toBe(true);
  });

  it("keeps formula-like literals as values through the memory adapter", () => {
    const plan: SheetPlan = {
      ...basePlan(),
      operations: [
        { id: "ensure", kind: "ensure-sheet", sheet: "Data" },
        {
          id: "write",
          kind: "write-range",
          sheet: "Data",
          range: "A1",
          values: [["=SUM(1)"]],
        },
      ],
    };
    const result = executeInMemory(plan, createEmptyWorkbook("test-workbook"), {
      dryRun: false,
      now: fixedNow,
    });
    expect(result.receipt.status).toBe("applied");
    expect(result.workbook.sheets["Data"]?.cells["A1"]).toEqual({ kind: "value", value: "=SUM(1)" });
  });

  it("fails closed on unknown plan versions and operation kinds", () => {
    expect(() => compilePlan({ ...basePlan(), schemaVersion: "opensheet.plan.v0" } as unknown)).toThrow(
      PlanValidationError,
    );
    expect(() =>
      compilePlan({
        ...basePlan(),
        operations: [{ id: "delete", kind: "delete-sheet", sheet: "Data" }],
      } as unknown),
    ).toThrow(/not supported/);
  });

  it("executes the cloned plan, not a mutated caller object", () => {
    const input = basePlan();
    const compiled = compilePlan(input);
    const originalDigest = compiled.digest;
    (input as { planId: string }).planId = "mutated-after-compile";
    input.operations.push({ id: "extra", kind: "ensure-sheet", sheet: "Other" });
    expect(compiled.plan.planId).toBe("test-plan");
    expect(compiled.plan.operations).toHaveLength(2);
    expect(compiled.digest).toBe(originalDigest);
    const result = executeInMemory(compiled.plan, createEmptyWorkbook("test-workbook"), {
      dryRun: false,
      now: fixedNow,
    });
    expect(result.receipt.planDigest).toBe(originalDigest);
    expect(result.workbook.sheets["Other"]).toBeUndefined();
  });

  it("returns a blocked receipt instead of throwing when a sheet is missing", () => {
    const plan: SheetPlan = {
      ...basePlan(),
      operations: [
        {
          id: "write",
          kind: "write-range",
          sheet: "Data",
          range: "A1",
          values: [["x"]],
        },
      ],
    };
    const workbook = createEmptyWorkbook("test-workbook");
    const original = JSON.stringify(workbook);
    const result = executeInMemory(plan, workbook, { dryRun: false, now: fixedNow });
    expect(result.receipt.status).toBe("blocked");
    expect(result.receipt.findings.map((finding) => finding.code)).toEqual(["missing_sheet"]);
    expect(JSON.stringify(workbook)).toBe(original);
    expect(result.workbook.sheets).toEqual({});
  });

  it("blocks when the plan target workbook does not match adapter state", () => {
    const result = executeInMemory(basePlan(), createEmptyWorkbook("other-workbook"), {
      dryRun: false,
      now: fixedNow,
    });
    expect(result.receipt.status).toBe("blocked");
    expect(result.receipt.findings[0]?.code).toBe("workbook_identity_mismatch");
    expect(result.workbook.sheets).toEqual({});
  });

  it("freezes the default formula-deny policy", () => {
    expect(DEFAULT_POLICY.allowFormulaWrites).toBe(false);
    expect(() => {
      (DEFAULT_POLICY as { allowFormulaWrites: boolean }).allowFormulaWrites = true;
    }).toThrow(TypeError);
    expect(DEFAULT_POLICY.allowFormulaWrites).toBe(false);
  });

  it("sorts gap-map unexpected constructs by code unit, not locale", () => {
    const compiled = compileGapMap({
      module: "gap-map",
      version: 1,
      workbook: "research",
      expected: [{ code: "A", name: "A", minimumItems: 1 }],
      observed: [
        { column: "A", constructCode: "A", itemCode: "A1" },
        { column: "B", constructCode: "é", itemCode: "E1" },
        { column: "C", constructCode: "Zed", itemCode: "Z1" },
      ],
    });
    const write = compiled.plan.operations[1];
    expect(write?.kind).toBe("write-range");
    if (write?.kind !== "write-range") {
      throw new Error("Expected a write-range operation.");
    }
    expect(write.values.slice(1).map((row) => row[0])).toEqual(["A", "Zed", "é"]);
    expect(compiled.digest).toBe(digestJson(compiled.plan));
  });

  it("rejects out-of-bounds column widths", () => {
    expect(() =>
      compilePlan({
        ...basePlan(),
        operations: [
          { id: "ensure", kind: "ensure-sheet", sheet: "Data" },
          {
            id: "widths",
            kind: "set-column-widths",
            sheet: "Data",
            widths: [{ column: "XFE", width: 12 }],
          },
        ],
      }),
    ).toThrow(/Excel-compatible/);
  });
});
