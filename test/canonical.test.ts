import { readFile } from "node:fs/promises";
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
    expect(() => canonicalize({ value: Number.POSITIVE_INFINITY })).toThrow(/non-finite/);
  });

  it("treats -0 as 0, matching JSON.stringify", () => {
    expect(canonicalize({ value: -0 })).toBe('{"value":0}');
  });

  it("matches the nested key-order fixture", async () => {
    const fixture = JSON.parse(
      await readFile(new URL("./fixtures/canonical/nested-key-order.json", import.meta.url), "utf8"),
    ) as unknown;
    expect(canonicalize(fixture)).toBe('{"a":{"c":3,"d":2},"z":1}');
    expect(digestJson(fixture)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
