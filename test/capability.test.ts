import { describe, expect, it } from "vitest";
import { MEMORY_CAPABILITY, createEmptyWorkbook, executeInMemory } from "../src/adapters/memory.js";
import { preflightPlan, type AdapterCapability } from "../src/core/capability.js";
import { compileScaleBank } from "../src/modules/scale-bank.js";
import { basePlan } from "./helpers.js";

const fixedNow = (): string => "2026-08-22T00:00:00.000Z";

function capabilityWith(
  operations: Partial<AdapterCapability["operations"]>,
): AdapterCapability {
  return {
    ...MEMORY_CAPABILITY,
    operations: {
      ...MEMORY_CAPABILITY.operations,
      ...operations,
    },
  };
}

describe("adapter capability preflight", () => {
  it("passes when every v1 operation is supported", () => {
    expect(preflightPlan(basePlan(), MEMORY_CAPABILITY)).toEqual({
      status: "pass",
      findings: [],
    });
  });

  it("blocks unsupported plan versions before mutation", () => {
    const capability: AdapterCapability = {
      ...MEMORY_CAPABILITY,
      planVersions: [],
    };
    const workbook = createEmptyWorkbook("test-workbook");
    const original = JSON.stringify(workbook);
    const result = executeInMemory(basePlan(), workbook, {
      dryRun: false,
      capability,
      now: fixedNow,
    });
    expect(result.receipt.status).toBe("blocked");
    expect(result.receipt.findings.map((finding) => finding.code)).toContain(
      "unsupported_plan_version",
    );
    expect(result.receipt.afterDigest).toBe(result.receipt.beforeDigest);
    expect(JSON.stringify(workbook)).toBe(original);
    expect(result.workbook.sheets).toEqual({});
  });

  it("blocks a scale-bank-like plan when set-format is unsupported", () => {
    const compiled = compileScaleBank({
      module: "scale-bank",
      version: 1,
      workbook: "research",
      constructs: [
        {
          code: "TRUST",
          name: "Trust",
          scale: { min: 1, max: 5 },
          items: [{ code: "T1", text: "Item one" }],
        },
      ],
    });
    const workbook = createEmptyWorkbook("research");
    const original = JSON.stringify(workbook);
    const result = executeInMemory(compiled.plan, workbook, {
      dryRun: false,
      now: fixedNow,
      capability: capabilityWith({ "set-format": "unsupported" }),
    });
    expect(result.receipt.status).toBe("blocked");
    expect(result.receipt.findings.some((finding) => finding.code === "unsupported_operation")).toBe(
      true,
    );
    expect(result.receipt.findings.some((finding) => finding.operationId === "scale.header-format")).toBe(
      true,
    );
    expect(result.workbook.sheets).toEqual({});
    expect(JSON.stringify(workbook)).toBe(original);
  });
});
