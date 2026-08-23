import { describe, expect, it } from "vitest";
import { columnNumberToName, parseA1Range, parseColumnName } from "../src/core/range.js";

describe("A1 range handling", () => {
  it("normalizes ranges and counts cells", () => {
    expect(parseA1Range("a1:c2")).toEqual({
      startRow: 1,
      startColumn: 1,
      endRow: 2,
      endColumn: 3,
      rowCount: 2,
      columnCount: 3,
      cellCount: 6,
      normalized: "A1:C2",
    });
  });

  it("converts boundary column numbers", () => {
    expect(columnNumberToName(1)).toBe("A");
    expect(columnNumberToName(26)).toBe("Z");
    expect(columnNumberToName(27)).toBe("AA");
    expect(columnNumberToName(16_384)).toBe("XFD");
  });

  it("rejects reversed and out-of-bounds ranges", () => {
    expect(() => parseA1Range("B2:A1")).toThrow(/top-left/);
    expect(() => parseA1Range("XFE1")).toThrow(/bounds/);
    expect(() => parseA1Range("A0")).toThrow(/Unsupported/);
  });

  it("rejects column names beyond XFD", () => {
    expect(parseColumnName("XFD")).toBe(16_384);
    expect(() => parseColumnName("XFE")).toThrow(/bounds/);
    expect(() => parseColumnName("a")).toThrow(/Unsupported/);
  });
});
