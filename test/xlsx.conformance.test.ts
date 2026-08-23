import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeXlsx } from "../src/adapters/xlsx.js";
import { compilePlan } from "../src/core/plan.js";
import { explodeSnapshot } from "../src/core/snapshot.js";
import type { SheetPlan } from "../src/core/types.js";
import { compileGapMap } from "../src/modules/gap-map.js";
import { compileScaleBank } from "../src/modules/scale-bank.js";
import { basePlan } from "./helpers.js";

const fixedNow = (): string => "2026-08-23T00:00:00.000Z";
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function tempFile(name: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "opensheet-xlsx-"));
  directories.push(directory);
  return join(directory, name);
}

describe("xlsx adapter", () => {
  it("dry-run does not write a file", async () => {
    const outputPath = await tempFile("preview.xlsx");
    const compiled = compileScaleBank({
      module: "scale-bank",
      version: 1,
      workbook: "research-demo",
      constructs: [
        {
          code: "TRUST",
          name: "Trust",
          scale: { min: 1, max: 5 },
          items: [{ code: "TRUST1", text: "I trust this service." }],
        },
      ],
    });
    const result = await executeXlsx(compiled.plan, { outputPath, dryRun: true, now: fixedNow });
    expect(result.receipt.status).toBe("dry-run");
    await expect(stat(outputPath)).rejects.toThrow();
  });

  it("writes a new workbook and keeps formula-like literals as values", async () => {
    const outputPath = await tempFile("literal.xlsx");
    const plan: SheetPlan = {
      ...basePlan(),
      target: { workbook: "test-workbook" },
      operations: [
        { id: "ensure", kind: "ensure-sheet", sheet: "Data" },
        {
          id: "write",
          kind: "write-range",
          sheet: "Data",
          range: "A1",
          values: [["=SUM(1)"]],
        },
      ],
    };
    const result = await executeXlsx(plan, { outputPath, dryRun: false, now: fixedNow });
    expect(result.receipt.status).toBe("applied");
    expect(result.snapshot.sheets[0]?.cells[0]).toEqual({
      address: "A1",
      kind: "value",
      value: "=SUM(1)",
    });
    const again = await executeXlsx(plan, { outputPath, dryRun: false, now: fixedNow });
    expect(again.receipt.status).toBe("blocked");
    expect(again.receipt.findings[0]?.code).toBe("overwrite_refused");
    expect(again.receipt.beforeDigest).toBe(result.receipt.afterDigest);
  });

  it("requires a state precondition before an explicit overwrite", async () => {
    const outputPath = await tempFile("overwrite.xlsx");
    const first = await executeXlsx(basePlan(), { outputPath, dryRun: false, now: fixedNow });
    const result = await executeXlsx(basePlan(), {
      inputPath: outputPath,
      outputPath,
      allowedSheets: ["Data"],
      overwrite: true,
      dryRun: false,
      now: fixedNow,
    });
    expect(first.receipt.status).toBe("applied");
    expect(result.receipt.status).toBe("blocked");
    expect(result.receipt.findings[0]?.code).toBe("overwrite_precondition_required");
  });

  it("blocks default formula writes before creating a file", async () => {
    const outputPath = await tempFile("formula.xlsx");
    const plan: SheetPlan = {
      ...basePlan(),
      operations: [
        { id: "ensure", kind: "ensure-sheet", sheet: "Data" },
        {
          id: "formula",
          kind: "write-formulas",
          sheet: "Data",
          range: "A1",
          formulas: [["=1+1"]],
        },
      ],
    };
    const result = await executeXlsx(plan, { outputPath, dryRun: false, now: fixedNow });
    expect(result.receipt.status).toBe("blocked");
    await expect(stat(outputPath)).rejects.toThrow();
  });

  it("round-trips a scale-bank example through read-back cells", async () => {
    const outputPath = await tempFile("scale.xlsx");
    const compiled = compileScaleBank({
      module: "scale-bank",
      version: 1,
      workbook: "research-demo",
      constructs: [
        {
          code: "TRUST",
          name: "Trust",
          scale: { min: 1, max: 5 },
          items: [{ code: "TRUST1", text: "I trust this service.", source: "Demo" }],
        },
      ],
    });
    const applied = await executeXlsx(compiled.plan, { outputPath, dryRun: false, now: fixedNow });
    expect(applied.receipt.status).toBe("applied");
    const exploded = explodeSnapshot(applied.snapshot);
    expect(exploded.sheets[0]?.cells.some((cell) => cell.value === "TRUST1")).toBe(true);
    expect(exploded.sheets[0]?.frozen).toEqual({ rows: 1, columns: 0 });
  });

  it("requires an allowlist when reading an existing file", async () => {
    const outputPath = await tempFile("first.xlsx");
    const compiled = compilePlan(basePlan());
    await executeXlsx(compiled.plan, { outputPath, dryRun: false, now: fixedNow });
    const second = await executeXlsx(compiled.plan, {
      inputPath: outputPath,
      outputPath: await tempFile("second.xlsx"),
      dryRun: false,
      now: fixedNow,
    });
    expect(second.receipt.status).toBe("blocked");
    expect(second.receipt.findings[0]?.code).toBe("sheet_allowlist_required");
  });

  it("round-trips a gap-map example", async () => {
    const outputPath = await tempFile("gap.xlsx");
    const compiled = compileGapMap({
      module: "gap-map",
      version: 1,
      workbook: "research-demo",
      expected: [{ code: "A", name: "A", minimumItems: 1 }],
      observed: [{ column: "B", constructCode: "A", itemCode: "A1" }],
    });
    const applied = await executeXlsx(compiled.plan, { outputPath, dryRun: false, now: fixedNow });
    expect(applied.receipt.status).toBe("applied");
    expect(applied.snapshot.sheets[0]?.cells.some((cell) => cell.value === "covered")).toBe(true);
  });

  it("blocks merged-cell input with a failure receipt", async () => {
    const mergedPath = await tempFile("merged.xlsx");
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Data");
    sheet.getCell("A1").value = "x";
    sheet.mergeCells("A1:B1");
    await workbook.xlsx.writeFile(mergedPath);
    const result = await executeXlsx(basePlan(), {
      inputPath: mergedPath,
      outputPath: await tempFile("from-merged.xlsx"),
      dryRun: false,
      now: fixedNow,
      allowedSheets: ["Data"],
    });
    expect(result.receipt.status).toBe("blocked");
    expect(result.receipt.findings.some((finding) => finding.code === "unsupported_workbook_feature")).toBe(
      true,
    );
  });

  it("blocks stale range preconditions", async () => {
    const firstPath = await tempFile("first.xlsx");
    const first = await executeXlsx(basePlan(), { outputPath: firstPath, dryRun: false, now: fixedNow });
    expect(first.receipt.status).toBe("applied");
    const result = await executeXlsx(basePlan(), {
      inputPath: firstPath,
      outputPath: await tempFile("stale.xlsx"),
      dryRun: false,
      now: fixedNow,
      allowedSheets: ["Data"],
      preconditions: {
        rangeDigests: [{ sheet: "Data", range: "A1:B2", digest: `sha256:${"0".repeat(64)}` }],
      },
    });
    expect(result.receipt.status).toBe("blocked");
    expect(result.receipt.findings[0]?.code).toBe("precondition_mismatch");
  });

  it("preserves list validation items that look like formulas", async () => {
    const outputPath = await tempFile("validation.xlsx");
    const plan: SheetPlan = {
      ...basePlan(),
      operations: [
        { id: "ensure", kind: "ensure-sheet", sheet: "Data" },
        {
          id: "write",
          kind: "write-range",
          sheet: "Data",
          range: "A1",
          values: [["x"]],
        },
        {
          id: "validate",
          kind: "set-data-validation",
          sheet: "Data",
          range: "A1",
          rule: { kind: "list", values: ["=SUM(1)", "ok"], allowBlank: true },
        },
      ],
    };
    const result = await executeXlsx(plan, { outputPath, dryRun: false, now: fixedNow });
    expect(result.receipt.status).toBe("applied");
    expect(result.snapshot.sheets[0]?.validations[0]?.rule).toMatchObject({
      kind: "list",
      values: ["=SUM(1)", "ok"],
    });
  });
});
