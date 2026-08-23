import { readFile } from "node:fs/promises";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createEmptyWorkbook, executeInMemory } from "../src/adapters/memory.js";
import { executeXlsx } from "../src/adapters/xlsx.js";
import { compilePlan } from "../src/core/plan.js";
import type { SheetPlan } from "../src/core/types.js";

const fixedNow = (): string => "2026-08-23T00:00:00.000Z";
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function loadPlan(name: string): Promise<SheetPlan> {
  const raw = JSON.parse(
    await readFile(new URL(`./fixtures/conformance/${name}`, import.meta.url), "utf8"),
  ) as unknown;
  return compilePlan(raw).plan;
}

describe("recorded conformance fixtures", () => {
  it("runs ensure-write on memory and xlsx with equivalent cells", async () => {
    const plan = await loadPlan("ensure-write.plan.json");
    const memory = executeInMemory(plan, createEmptyWorkbook("test-workbook"), {
      dryRun: false,
      now: fixedNow,
    });
    expect(memory.receipt.status).toBe("applied");
    expect(memory.workbook.sheets["Data"]?.cells["A2"]).toEqual({ kind: "value", value: "A" });

    const directory = await mkdtemp(join(tmpdir(), "opensheet-fix-"));
    directories.push(directory);
    const outputPath = join(directory, "ensure-write.xlsx");
    const xlsx = await executeXlsx(plan, { outputPath, dryRun: false, now: fixedNow });
    expect(xlsx.receipt.status).toBe("applied");
    expect(xlsx.snapshot.sheets[0]?.cells.some((cell) => cell.address === "A2" && cell.value === "A")).toBe(
      true,
    );
    expect(xlsx.snapshot.sheets[0]?.frozen).toEqual({ rows: 1, columns: 0 });
  });

  it("keeps formula-like literals as values on both adapters", async () => {
    const plan = await loadPlan("literal-equals.plan.json");
    const memory = executeInMemory(plan, createEmptyWorkbook("test-workbook"), {
      dryRun: false,
      now: fixedNow,
    });
    expect(memory.workbook.sheets["Data"]?.cells["A1"]).toEqual({ kind: "value", value: "=SUM(1)" });

    const directory = await mkdtemp(join(tmpdir(), "opensheet-fix-"));
    directories.push(directory);
    const xlsx = await executeXlsx(plan, {
      outputPath: join(directory, "literal.xlsx"),
      dryRun: false,
      now: fixedNow,
    });
    expect(xlsx.snapshot.sheets[0]?.cells[0]).toEqual({
      address: "A1",
      kind: "value",
      value: "=SUM(1)",
    });
  });

  it("blocks formula writes on both adapters without creating an xlsx file", async () => {
    const plan = await loadPlan("formula-blocked.plan.json");
    const memory = executeInMemory(plan, createEmptyWorkbook("test-workbook"), {
      dryRun: false,
      now: fixedNow,
    });
    expect(memory.receipt.status).toBe("blocked");
    expect(memory.receipt.findings[0]?.code).toBe("formula_write_blocked");

    const directory = await mkdtemp(join(tmpdir(), "opensheet-fix-"));
    directories.push(directory);
    const outputPath = join(directory, "blocked.xlsx");
    const xlsx = await executeXlsx(plan, { outputPath, dryRun: false, now: fixedNow });
    expect(xlsx.receipt.status).toBe("blocked");
    await expect(stat(outputPath)).rejects.toThrow();
  });
});
