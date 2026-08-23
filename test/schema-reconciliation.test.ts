import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { MEMORY_CAPABILITY, createEmptyWorkbook, executeInMemory } from "../src/adapters/memory.js";
import { compilePlan } from "../src/core/plan.js";
import { snapshotMemoryWorkbook } from "../src/core/snapshot.js";
import { assertSheetPlan, PlanValidationError } from "../src/core/validation.js";
import { compileGapMap } from "../src/modules/gap-map.js";
import { compileScaleBank } from "../src/modules/scale-bank.js";
import { basePlan } from "./helpers.js";

type ValidateFn = ((value: unknown) => boolean) & { errors: unknown };

async function loadSchema(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(new URL(`../schemas/${name}`, import.meta.url), "utf8"),
  ) as Record<string, unknown>;
}

function createAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv;
}

function fullPlan() {
  return {
    schemaVersion: "opensheet.plan.v1",
    planId: "full-contract",
    source: { module: "test", version: "1" },
    target: { workbook: "test-workbook" },
    operations: [
      { id: "ensure", kind: "ensure-sheet", sheet: "Data" },
      {
        id: "write",
        kind: "write-range",
        sheet: "Data",
        range: "A1:B2",
        values: [
          ["Name", "Score"],
          ["A", 5],
        ],
      },
      {
        id: "formula",
        kind: "write-formulas",
        sheet: "Data",
        range: "C1",
        formulas: [["=B2"]],
      },
      {
        id: "rule",
        kind: "set-data-validation",
        sheet: "Data",
        range: "B2",
        rule: { kind: "number-between", min: 0, max: 10, allowBlank: false },
      },
      {
        id: "format",
        kind: "set-format",
        sheet: "Data",
        range: "A1:B1",
        format: { bold: true, backgroundColor: "#DCEFEA" },
      },
      { id: "freeze", kind: "freeze-pane", sheet: "Data", rows: 1, columns: 0 },
      {
        id: "widths",
        kind: "set-column-widths",
        sheet: "Data",
        widths: [{ column: "A", width: 18 }],
      },
    ],
    metadata: { fixture: "full" },
  };
}

describe("JSON Schema / TypeScript reconciliation", () => {
  it("does not import Ajv from src/", async () => {
    const srcRoot = fileURLToPath(new URL("../src", import.meta.url));
    const queue = [srcRoot];
    const hits: string[] = [];
    while (queue.length > 0) {
      const directory = queue.pop();
      if (!directory) {
        continue;
      }
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          queue.push(path);
          continue;
        }
        if (!entry.name.endsWith(".ts")) {
          continue;
        }
        const source = await readFile(path, "utf8");
        if (/\bajv\b/i.test(source) || /\bajv-formats\b/i.test(source)) {
          hits.push(path);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("accepts the same valid fixtures in Ajv and assertSheetPlan", async () => {
    const ajv = createAjv();
    const validate = ajv.compile(await loadSchema("plan.v1.schema.json")) as ValidateFn;
    const receiptValidate = ajv.compile(await loadSchema("receipt.v1.schema.json")) as ValidateFn;
    const capabilityValidate = ajv.compile(await loadSchema("capability.v1.schema.json")) as ValidateFn;
    const snapshotValidate = ajv.compile(await loadSchema("snapshot.v1.schema.json")) as ValidateFn;
    expect(receiptValidate.errors).toBeNull();
    expect(capabilityValidate(MEMORY_CAPABILITY), JSON.stringify(capabilityValidate.errors)).toBe(true);

    const applied = executeInMemory(basePlan(), createEmptyWorkbook("test-workbook"), {
      dryRun: false,
      now: () => "2026-08-22T00:00:00.000Z",
    });
    expect(snapshotValidate(snapshotMemoryWorkbook(applied.workbook)), JSON.stringify(snapshotValidate.errors)).toBe(
      true,
    );
    expect(receiptValidate(applied.receipt), JSON.stringify(receiptValidate.errors)).toBe(true);

    const fixtures = [
      basePlan(),
      fullPlan(),
      compileScaleBank({
        module: "scale-bank",
        version: 1,
        workbook: "research",
        constructs: [
          {
            code: "TRUST",
            name: "Trust",
            scale: { min: 1, max: 5 },
            items: [{ code: "T1", text: "Item one" }],
          },
        ],
      }).plan,
      compileGapMap({
        module: "gap-map",
        version: 1,
        workbook: "research",
        expected: [{ code: "A", name: "A", minimumItems: 1 }],
        observed: [{ column: "A", constructCode: "A", itemCode: "A1" }],
      }).plan,
    ];

    for (const fixture of fixtures) {
      expect(() => assertSheetPlan(fixture)).not.toThrow();
      expect(compilePlan(fixture).digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it("rejects the shared invalid corpus in both validators", async () => {
    const ajv = createAjv();
    const validate = ajv.compile(await loadSchema("plan.v1.schema.json")) as ValidateFn;
    const corpus: unknown[] = [
      { ...basePlan(), surprise: true },
      { ...basePlan(), schemaVersion: "opensheet.plan.v0" },
      {
        ...basePlan(),
        operations: [
          { id: "ensure", kind: "ensure-sheet", sheet: "Data" },
          { id: "ensure", kind: "ensure-sheet", sheet: "Data" },
        ],
      },
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          {
            id: "formula",
            kind: "write-formulas",
            sheet: "Data",
            range: "A1",
            formulas: [["SUM(A2:A4)"]],
          },
        ],
      },
      { ...basePlan(), operations: [] },
    ];

    for (const fixture of corpus) {
      expect(() => assertSheetPlan(fixture)).toThrow(PlanValidationError);
      expect(validate(fixture)).toBe(false);
    }
  });

  it("documents residual gaps that JSON Schema cannot express", async () => {
    const ajv = createAjv();
    const validate = ajv.compile(await loadSchema("plan.v1.schema.json")) as ValidateFn;

    const schemaCannotExpress: unknown[] = [
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          { id: "write", kind: "write-range", sheet: "Data", range: "B2:A1", values: [["A"]] },
        ],
      },
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          { id: "write", kind: "write-range", sheet: "Data", range: "XFE1", values: [["A"]] },
        ],
      },
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          {
            id: "write",
            kind: "write-range",
            sheet: "Data",
            range: "A1:B2",
            values: [
              ["A", "B"],
              ["C"],
            ],
          },
        ],
      },
      {
        ...basePlan(),
        operations: [
          basePlan().operations[0],
          { ...basePlan().operations[1], range: "A1:C2" },
        ],
      },
      {
        ...basePlan(),
        operations: [basePlan().operations[0], { ...basePlan().operations[1], id: "ensure" }],
      },
    ];

    for (const fixture of schemaCannotExpress) {
      expect(() => assertSheetPlan(fixture)).toThrow(PlanValidationError);
      expect(validate(fixture)).toBe(true);
    }

    const nonFinite = {
      ...basePlan(),
      operations: [
        basePlan().operations[0],
        { id: "write", kind: "write-range", sheet: "Data", range: "A1", values: [[Number.POSITIVE_INFINITY]] },
      ],
    };
    expect(() => assertSheetPlan(nonFinite)).toThrow(PlanValidationError);

    const lowercaseRange = {
      ...basePlan(),
      operations: [
        basePlan().operations[0],
        { ...basePlan().operations[1], range: "a1:b2" },
      ],
    };
    expect(() => assertSheetPlan(lowercaseRange)).not.toThrow();
    expect(validate(lowercaseRange)).toBe(false);
  });
});
