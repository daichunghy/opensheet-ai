import { describe, expect, it } from "vitest";
import { IntentValidationError } from "../src/core/errors.js";
import { compileKpiThreshold, kpiStatus } from "../src/modules/kpi-threshold.js";

const intent = {
  module: "kpi-threshold" as const,
  version: 1 as const,
  workbook: "ops-demo",
  kpis: [
    { code: "NPS", name: "NPS", actual: 42, target: 50, warnBelow: 45 },
    { code: "CSAT", name: "CSAT", actual: 4.6, target: 4.5 },
  ],
};

describe("kpi-threshold module", () => {
  it("classifies met, watch, and below", () => {
    expect(kpiStatus({ code: "A", name: "A", actual: 10, target: 10 })).toBe("met");
    expect(kpiStatus({ code: "B", name: "B", actual: 8, target: 10, warnBelow: 7 })).toBe("watch");
    expect(kpiStatus({ code: "C", name: "C", actual: 1, target: 10, warnBelow: 7 })).toBe("below");
  });

  it("compiles a deterministic validated plan", () => {
    const first = compileKpiThreshold(intent);
    const second = compileKpiThreshold(intent);
    expect(first.digest).toBe(second.digest);
    const write = first.plan.operations[1];
    expect(write?.kind).toBe("write-range");
    if (write?.kind !== "write-range") {
      throw new Error("expected write-range");
    }
    expect(write.values.slice(1).map((row) => row[5])).toEqual(["below", "met"]);
  });

  it("rejects extra keys and inverted warnBelow", () => {
    expect(() => compileKpiThreshold({ ...intent, extra: true })).toThrow(IntentValidationError);
    expect(() =>
      compileKpiThreshold({
        ...intent,
        kpis: [{ code: "X", name: "X", actual: 1, target: 2, warnBelow: 5 }],
      }),
    ).toThrow(/warnBelow/);
  });
});
