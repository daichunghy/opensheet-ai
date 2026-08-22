import { describe, expect, it } from "vitest";
import { compileGapMap } from "../src/modules/gap-map.js";
import { compileScaleBank } from "../src/modules/scale-bank.js";

describe("foundation business modules", () => {
  it("compiles a deterministic scale-bank plan", () => {
    const intent = {
      module: "scale-bank" as const,
      version: 1 as const,
      workbook: "research",
      constructs: [
        {
          code: "TRUST",
          name: "Trust",
          scale: { min: 1, max: 5 },
          items: [
            { code: "T1", text: "Item one" },
            { code: "T2", text: "Item two", reverse: true },
          ],
        },
      ],
    };
    const first = compileScaleBank(intent);
    const second = compileScaleBank(intent);
    expect(first.digest).toBe(second.digest);
    expect(first.plan.metadata).toEqual({ constructCount: "1", itemCount: "2" });
    expect(first.plan.operations[1]).toMatchObject({ kind: "write-range", range: "A1:H3" });
  });

  it("rejects duplicate scale item codes", () => {
    expect(() =>
      compileScaleBank({
        module: "scale-bank",
        version: 1,
        workbook: "research",
        constructs: [
          {
            code: "A",
            name: "A",
            scale: { min: 1, max: 5 },
            items: [
              { code: "X", text: "One" },
              { code: "X", text: "Two" },
            ],
          },
        ],
      }),
    ).toThrow(/Duplicate scale item code/);
  });

  it("classifies covered, partial, missing, and unexpected gaps", () => {
    const compiled = compileGapMap({
      module: "gap-map",
      version: 1,
      workbook: "research",
      expected: [
        { code: "A", name: "A", minimumItems: 1 },
        { code: "B", name: "B", minimumItems: 2 },
        { code: "C", name: "C", minimumItems: 1 },
      ],
      observed: [
        { column: "A", constructCode: "A", itemCode: "A1" },
        { column: "B", constructCode: "B", itemCode: "B1" },
        { column: "C", constructCode: "X", itemCode: "X1" },
      ],
    });
    const write = compiled.plan.operations[1];
    expect(write.kind).toBe("write-range");
    if (write.kind !== "write-range") {
      throw new Error("Expected a write-range operation.");
    }
    expect(write.values.slice(1).map((row) => row[5])).toEqual([
      "covered",
      "partial",
      "missing",
      "unexpected",
    ]);
  });
});
