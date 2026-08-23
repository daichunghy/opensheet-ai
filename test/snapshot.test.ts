import { describe, expect, it } from "vitest";
import { createEmptyWorkbook, executeInMemory } from "../src/adapters/memory.js";
import {
  diffSnapshots,
  digestSnapshot,
  emptySemanticDiff,
  snapshotMemoryWorkbook,
} from "../src/core/snapshot.js";
import { basePlan } from "./helpers.js";

const fixedNow = (): string => "2026-08-22T00:00:00.000Z";

describe("workbook snapshot and semantic diff", () => {
  it("diffs an applied base plan as one sheet and four cells", () => {
    const beforeWorkbook = createEmptyWorkbook("test-workbook");
    const before = snapshotMemoryWorkbook(beforeWorkbook);
    const result = executeInMemory(basePlan(), beforeWorkbook, { dryRun: false, now: fixedNow });
    const after = snapshotMemoryWorkbook(result.workbook);
    const diff = diffSnapshots(before, after);

    expect(after.schemaVersion).toBe("opensheet.snapshot.v1");
    expect(after.sheets.map((sheet) => sheet.name)).toEqual(["Data"]);
    expect(after.sheets[0]?.cells).toHaveLength(4);
    expect(diff.sheets.added).toEqual(["Data"]);
    expect(diff.cells.added).toHaveLength(4);
    expect(digestSnapshot(after)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("produces an empty diff for dry-run versus the caller original", () => {
    const workbook = createEmptyWorkbook("test-workbook");
    const original = snapshotMemoryWorkbook(workbook);
    const result = executeInMemory(basePlan(), workbook, { dryRun: true, now: fixedNow });
    expect(diffSnapshots(original, snapshotMemoryWorkbook(result.workbook))).toEqual(
      emptySemanticDiff(),
    );
    expect(diffSnapshots(original, snapshotMemoryWorkbook(workbook))).toEqual(emptySemanticDiff());
  });
});
