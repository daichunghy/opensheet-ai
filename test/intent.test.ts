import { describe, expect, it } from "vitest";
import { digestJson } from "../src/core/canonical.js";
import { IntentValidationError } from "../src/core/errors.js";
import { parseGapMapIntent, parseScaleBankIntent } from "../src/modules/intent.js";
import { compileGapMap } from "../src/modules/gap-map.js";
import { compileScaleBank } from "../src/modules/scale-bank.js";

const scaleIntent = {
  module: "scale-bank" as const,
  version: 1 as const,
  workbook: "research",
  constructs: [
    {
      code: "TRUST",
      name: "Trust",
      scale: { min: 1, max: 5 },
      items: [{ code: "T1", text: "Item one" }],
    },
  ],
};

describe("closed-world intents", () => {
  it("rejects extra properties on scale-bank intents", () => {
    expect(() => parseScaleBankIntent({ ...scaleIntent, surprise: true })).toThrow(IntentValidationError);
    expect(() => parseScaleBankIntent({ ...scaleIntent, surprise: true })).toThrow(/unsupported property/);
  });

  it("rejects missing constructs with a stable code", () => {
    try {
      parseScaleBankIntent({ module: "scale-bank", version: 1, workbook: "research" });
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(IntentValidationError);
      expect((error as IntentValidationError).details[0]?.code).toBe("empty_collection");
    }
  });

  it("rejects illegal sheet names before compilation", () => {
    expect(() => parseScaleBankIntent({ ...scaleIntent, sheetName: "Bad[]" })).toThrow(/safely map/);
  });

  it("rejects out-of-bounds observed columns", () => {
    expect(() =>
      parseGapMapIntent({
        module: "gap-map",
        version: 1,
        workbook: "research",
        expected: [{ code: "A", name: "A", minimumItems: 1 }],
        observed: [{ column: "XFE", constructCode: "A", itemCode: "A1" }],
      }),
    ).toThrow(/Excel-compatible/);
  });

  it("keeps planId stable across key order and rejects extra keys from the digest", () => {
    const first = compileScaleBank(scaleIntent);
    const second = compileScaleBank({
      constructs: scaleIntent.constructs,
      workbook: "research",
      version: 1,
      module: "scale-bank",
    });
    expect(first.plan.planId).toBe(second.plan.planId);
    expect(first.digest).toBe(digestJson(first.plan));
    expect(() => compileScaleBank({ ...scaleIntent, extra: "nope" })).toThrow(IntentValidationError);
  });

  it("compiles a parsed gap-map intent", () => {
    const compiled = compileGapMap({
      module: "gap-map",
      version: 1,
      workbook: "research",
      expected: [{ code: "A", name: "A", minimumItems: 1 }],
      observed: [],
    });
    expect(compiled.plan.metadata["expectedConstructCount"]).toBe("1");
  });
});
