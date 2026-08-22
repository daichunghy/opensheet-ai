import type { SheetPlan } from "../src/core/types.js";

export function basePlan(): SheetPlan {
  return {
    schemaVersion: "opensheet.plan.v1",
    planId: "test-plan",
    source: { module: "test", version: "1" },
    target: { workbook: "test-workbook" },
    operations: [
      { id: "ensure", kind: "ensure-sheet", sheet: "Data" },
      {
        id: "write",
        kind: "write-range",
        sheet: "Data",
        range: "A1:B2",
        values: [
          ["Name", "Score"],
          ["A", 5],
        ],
      },
    ],
    metadata: {},
  };
}
