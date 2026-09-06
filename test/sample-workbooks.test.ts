import { statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));

describe("distributed example workbooks", () => {
  it.each([
    ["inventory-revenue", "sample.xlsx", ["Read me", "Inventory Revenue"], ["DAILY_REVENUE", "GROSS_MARGIN"]],
    ["service-quality", "sample.xlsx", ["Read me", "Scale Bank"], ["REL1", "SAT3"]],
  ] as const)("ships a readable %s workbook", async (folder, filename, sheetNames, markers) => {
    const path = join(root, "examples", folder, filename);
    expect(statSync(path).size).toBeGreaterThan(1000);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(sheetNames);
    const sheet = workbook.getWorksheet(sheetNames[1]);
    expect(sheet).toBeDefined();
    const values: unknown[] = [];
    sheet?.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => values.push(cell.value));
    });
    for (const marker of markers) {
      expect(values.some((value) => value === marker)).toBe(true);
    }
  });
});
