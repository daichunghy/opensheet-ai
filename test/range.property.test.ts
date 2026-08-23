import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RangeParseError } from "../src/core/errors.js";
import { columnNumberToName, parseA1Range } from "../src/core/range.js";

describe("A1 range properties", () => {
  it("round-trips columnNumberToName for sampled Excel columns", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 16_384 }), (column) => {
        const name = columnNumberToName(column);
        expect(parseA1Range(`${name}1`).startColumn).toBe(column);
        expect(columnNumberToName(parseA1Range(`${name}1`).startColumn)).toBe(name);
      }),
      { numRuns: 80 },
    );
  });

  it("never accepts reversed ranges, A0, XFE1, unions, or sheet prefixes", () => {
    expect(() => parseA1Range("B2:A1")).toThrow(RangeError);
    expect(() => parseA1Range("A0")).toThrow(/Unsupported/);
    expect(() => parseA1Range("XFE1")).toThrow(/bounds/);
    expect(() => parseA1Range("A1,B1")).toThrow(RangeError);
    expect(() => parseA1Range("Sheet1!A1")).toThrow(RangeError);
    expect(() => parseA1Range("$A$1")).toThrow(RangeError);

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 40 }),
        fc.integer({ min: 1, max: 40 }),
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 30 }),
        (startRow, endRow, startColumn, endColumn) => {
          if (endColumn >= startColumn && endRow >= startRow) {
            return;
          }
          const range = `${columnNumberToName(startColumn)}${startRow}:${columnNumberToName(endColumn)}${endRow}`;
          expect(() => parseA1Range(range)).toThrow(RangeError);
        },
      ),
      { numRuns: 80 },
    );
  });

  it("parses or throws RangeError for arbitrary strings", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (input) => {
        try {
          const parsed = parseA1Range(input);
          expect(parsed.endRow).toBeGreaterThanOrEqual(parsed.startRow);
          expect(parsed.endColumn).toBeGreaterThanOrEqual(parsed.startColumn);
          expect(parsed.cellCount).toBe(parsed.rowCount * parsed.columnCount);
        } catch (error) {
          expect(error).toBeInstanceOf(RangeError);
          expect(error).toBeInstanceOf(RangeParseError);
        }
      }),
      { numRuns: 100 },
    );
  });
});
