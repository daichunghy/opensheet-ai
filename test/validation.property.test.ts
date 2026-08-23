import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PlanValidationError } from "../src/core/errors.js";
import { assertSheetPlan } from "../src/core/validation.js";
import { basePlan } from "./helpers.js";

function planWithValues(values: unknown): unknown {
  const plan = basePlan();
  return {
    ...plan,
    operations: [
      plan.operations[0],
      {
        id: "write",
        kind: "write-range",
        sheet: "Data",
        range: "A1:B2",
        values,
      },
    ],
  };
}

function planWithFormula(text: string): unknown {
  const plan = basePlan();
  return {
    ...plan,
    operations: [
      plan.operations[0],
      {
        id: "formula",
        kind: "write-formulas",
        sheet: "Data",
        range: "A1",
        formulas: [[text]],
      },
    ],
  };
}

describe("plan validation properties", () => {
  it("rejects jagged matrices", () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.array(fc.string({ maxLength: 8 }), { minLength: 1, maxLength: 4 }), {
            minLength: 2,
            maxLength: 5,
          })
          .filter((rows) => rows.some((row) => row.length !== rows[0]?.length)),
        (values) => {
          expect(() => assertSheetPlan(planWithValues(values))).toThrow(PlanValidationError);
        },
      ),
      { numRuns: 60 },
    );
  });

  it("rejects formula cells that do not begin with =", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 20 }).filter((value) => !value.startsWith("=")),
        (text) => {
          expect(() => assertSheetPlan(planWithFormula(text))).toThrow(PlanValidationError);
          expect(() => assertSheetPlan(planWithFormula(text))).toThrow(/beginning with '='/);
        },
      ),
      { numRuns: 60 },
    );
  });
});
