import { describe, expect, it } from "vitest";
import { ERROR_CODES, PlanValidationError, PolicyConfigurationError } from "../src/core/errors.js";
import { compilePlan } from "../src/core/plan.js";
import { evaluatePolicy } from "../src/core/policy.js";
import { basePlan } from "./helpers.js";

function expectCodes(value: unknown, codes: readonly string[]): PlanValidationError {
  try {
    compilePlan(value);
    throw new Error("expected PlanValidationError");
  } catch (error) {
    expect(error).toBeInstanceOf(PlanValidationError);
    if (!(error instanceof PlanValidationError)) {
      throw error;
    }
    expect(error.details.map((detail) => detail.code)).toEqual(expect.arrayContaining([...codes]));
    expect(error.issues).toEqual(error.details.map((detail) => detail.message));
    return error;
  }
}

describe("stable plan error codes", () => {
  it("keeps human-readable messages for existing matchers", () => {
    const dimension = expectCodes(
      {
        ...basePlan(),
        operations: [basePlan().operations[0], { ...basePlan().operations[1], range: "A1:C2" }],
      },
      [ERROR_CODES.matrix_dimension_mismatch],
    );
    expect(dimension.message).toMatch(/do not match range/);

    const unique = expectCodes(
      {
        ...basePlan(),
        operations: [basePlan().operations[0], { ...basePlan().operations[1], id: "ensure" }],
      },
      [ERROR_CODES.duplicate_operation_id],
    );
    expect(unique.message).toMatch(/unique/);

    const extra = expectCodes({ ...basePlan(), surprise: true }, [ERROR_CODES.unsupported_property]);
    expect(extra.message).toMatch(/unsupported property/);

    const formula = expectCodes(
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          {
            id: "formula",
            kind: "write-formulas",
            sheet: "Data",
            range: "A1",
            formulas: [["SUM(A2:A4)"]],
          },
        ],
      },
      [ERROR_CODES.formula_not_explicit],
    );
    expect(formula.message).toMatch(/beginning with '='/);
  });

  it("covers the published validation code set", () => {
    expectCodes(null, [ERROR_CODES.plan_not_object]);
    expectCodes({ ...basePlan(), schemaVersion: "opensheet.plan.v0" }, [
      ERROR_CODES.invalid_schema_version,
    ]);
    expectCodes({ ...basePlan(), planId: "" }, [ERROR_CODES.invalid_identifier]);
    expectCodes(
      {
        ...basePlan(),
        operations: [{ id: "ensure", kind: "ensure-sheet", sheet: "Bad[Name]" }],
      },
      [ERROR_CODES.invalid_sheet_name],
    );
    expectCodes(
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          { id: "write", kind: "write-range", sheet: "Data", range: "not-a-range", values: [["A"]] },
        ],
      },
      [ERROR_CODES.invalid_range],
    );
    expectCodes(
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          { id: "write", kind: "write-range", sheet: "Data", range: "XFE1", values: [["A"]] },
        ],
      },
      [ERROR_CODES.range_bounds_exceeded],
    );
    expectCodes(
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          { id: "write", kind: "write-range", sheet: "Data", range: "B2:A1", values: [["A"]] },
        ],
      },
      [ERROR_CODES.range_reversed],
    );
    expectCodes(
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          { id: "write", kind: "write-range", sheet: "Data", range: "A1", values: [] },
        ],
      },
      [ERROR_CODES.matrix_empty],
    );
    expectCodes(
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          {
            id: "write",
            kind: "write-range",
            sheet: "Data",
            range: "A1:B2",
            values: [["A"], ["B", "C"]],
          },
        ],
      },
      [ERROR_CODES.matrix_not_rectangular],
    );
    expectCodes(
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          { id: "write", kind: "write-range", sheet: "Data", range: "A1", values: [[Number.POSITIVE_INFINITY]] },
        ],
      },
      [ERROR_CODES.invalid_cell_value],
    );
    expectCodes(
      {
        ...basePlan(),
        operations: [{ id: "gone", kind: "delete-sheet", sheet: "Data" }],
      },
      [ERROR_CODES.unknown_operation_kind],
    );
    expectCodes(
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          {
            id: "format",
            kind: "set-format",
            sheet: "Data",
            range: "A1",
            format: {},
          },
        ],
      },
      [ERROR_CODES.invalid_format],
    );
    expectCodes(
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          {
            id: "rule",
            kind: "set-data-validation",
            sheet: "Data",
            range: "A1",
            rule: { kind: "regex", allowBlank: true },
          },
        ],
      },
      [ERROR_CODES.invalid_validation_rule],
    );
    expectCodes(
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          { id: "freeze", kind: "freeze-pane", sheet: "Data", rows: -1, columns: 0 },
        ],
      },
      [ERROR_CODES.invalid_freeze],
    );
    expectCodes(
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          {
            id: "widths",
            kind: "set-column-widths",
            sheet: "Data",
            widths: [{ column: "A", width: 0 }],
          },
        ],
      },
      [ERROR_CODES.invalid_column_width],
    );
    expectCodes({ ...basePlan(), operations: [] }, [ERROR_CODES.empty_operations]);
    expectCodes({ ...basePlan(), metadata: { n: 1 } }, [ERROR_CODES.invalid_metadata]);
    expectCodes({ ...basePlan(), source: "nope" }, [ERROR_CODES.invalid_source]);
    expectCodes({ ...basePlan(), target: "nope" }, [ERROR_CODES.invalid_target]);
    expectCodes({ ...basePlan(), operations: ["nope"] }, [ERROR_CODES.invalid_operation]);
  });

  it("codes policy constructor failures as invalid_policy", () => {
    expect(() =>
      evaluatePolicy(basePlan(), {
        maxOperations: -1,
        maxTouchedCells: 10,
        allowSheetCreation: true,
        allowFormulaWrites: false,
        allowFormatting: true,
      }),
    ).toThrow(PolicyConfigurationError);
    try {
      evaluatePolicy(basePlan(), {
        maxOperations: -1,
        maxTouchedCells: 10,
        allowSheetCreation: true,
        allowFormulaWrites: false,
        allowFormatting: true,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(PolicyConfigurationError);
      if (error instanceof PolicyConfigurationError) {
        expect(error.code).toBe(ERROR_CODES.invalid_policy);
        expect(error.message).toMatch(/maxOperations/);
      }
    }
  });
});
