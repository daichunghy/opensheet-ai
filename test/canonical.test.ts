import { describe, expect, it } from "vitest";
import { canonicalize, digestJson } from "../src/core/canonical.js";

describe("canonical JSON", () => {
  it("sorts object keys recursively", () => {
    expect(canonicalize({ z: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"z":1}');
  });

  it("produces the same digest for equivalent key order", () => {
    expect(digestJson({ b: 2, a: 1 })).toBe(digestJson({ a: 1, b: 2 }));
  });

  it("rejects non-finite and undefined values", () => {
    expect(() => canonicalize({ value: Number.NaN })).toThrow(/non-finite/);
    expect(() => canonicalize({ value: undefined })).toThrow(/undefined/);
  });
});
