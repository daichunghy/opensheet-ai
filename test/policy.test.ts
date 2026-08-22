import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "../src/core/policy.js";
import type { SheetPlan } from "../src/core/types.js";
import { basePlan } from "./helpers.js";

describe("policy evaluation", () => {
  it("passes a bounded value-only plan", () => {
    expect(evaluatePolicy(basePlan())).toEqual({ status: "pass", findings: [] });
  });

  it("blocks formula writes by default", () => {
    const plan: SheetPlan = {
      ...basePlan(),
      operations: [
        { id: "ensure", kind: "ensure-sheet", sheet: "Data" },
        {
          id: "formula",
          kind: "write-formulas",
          sheet: "Data",
          range: "A1",
          formulas: [["=SUM(A2:A4)"]],
        },
      ],
    };
    expect(evaluatePolicy(plan)).toMatchObject({
      status: "blocked",
      findings: [{ code: "formula_write_blocked", operationId: "formula" }],
    });
  });

  it("enforces sheet and cell budgets", () => {
    const decision = evaluatePolicy(basePlan(), {
      maxOperations: 5,
      maxTouchedCells: 3,
      allowSheetCreation: true,
      allowFormulaWrites: false,
      allowFormatting: true,
      allowedSheets: ["Allowed"],
    });
    expect(decision.status).toBe("blocked");
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "cell_budget_exceeded",
      "sheet_not_allowed",
      "sheet_not_allowed",
    ]);
  });

  it("rejects nonsensical policy budgets", () => {
    expect(() =>
      evaluatePolicy(basePlan(), {
        maxOperations: -1,
        maxTouchedCells: 10,
        allowSheetCreation: true,
        allowFormulaWrites: false,
        allowFormatting: true,
      }),
    ).toThrow(/maxOperations/);
  });
});
