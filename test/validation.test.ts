import { describe, expect, it } from "vitest";
import { compilePlan } from "../src/core/plan.js";
import { PlanValidationError } from "../src/core/validation.js";
import { basePlan } from "./helpers.js";

describe("plan validation", () => {
  it("accepts the versioned foundation contract", () => {
    const compiled = compilePlan(basePlan());
    expect(compiled.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(compiled.summary).toEqual({
      operationCount: 2,
      touchedCellCount: 4,
      sheets: ["Data"],
      containsFormulaWrites: false,
    });
  });

  it("rejects matrix and range dimension drift", () => {
    const plan = basePlan();
    const invalid = {
      ...plan,
      operations: [
        plan.operations[0],
        { ...plan.operations[1], range: "A1:C2" },
      ],
    };
    expect(() => compilePlan(invalid)).toThrow(/do not match range/);
  });

  it("rejects duplicate operation ids", () => {
    const plan = basePlan();
    const invalid = {
      ...plan,
      operations: [plan.operations[0], { ...plan.operations[1], id: "ensure" }],
    };
    expect(() => compilePlan(invalid)).toThrow(PlanValidationError);
    expect(() => compilePlan(invalid)).toThrow(/unique/);
  });

  it("rejects unknown properties instead of ignoring contract drift", () => {
    expect(() => compilePlan({ ...basePlan(), surprise: true })).toThrow(/unsupported property/);
  });

  it("does not silently treat literal text as a formula", () => {
    const plan = basePlan();
    const invalid = {
      ...plan,
      operations: [
        plan.operations[0],
        {
          id: "formula",
          kind: "write-formulas",
          sheet: "Data",
          range: "A1",
          formulas: [["SUM(A2:A4)"]],
        },
      ],
    };
    expect(() => compilePlan(invalid)).toThrow(/beginning with '='/);
  });
});
