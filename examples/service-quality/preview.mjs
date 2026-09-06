#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { compileScaleBank } from "opensheet-ai";
import { createEmptyWorkbook, memoryAdapter } from "opensheet-ai/memory";

const PREVIEW_AT = "2026-08-27T00:00:00.000Z";
const EXECUTOR = "opensheet-ai/example/service-quality";
const intent = JSON.parse(await readFile(new URL("./intent.json", import.meta.url), "utf8"));
const compiled = compileScaleBank(intent);

function tableFromPlan(plan) {
  const write = plan.operations.find((operation) => operation.kind === "write-range");
  if (!write || write.kind !== "write-range") {
    throw new Error("Expected the scale-bank plan to contain a write-range operation.");
  }
  const [header, ...rows] = write.values;
  if (!header || rows.length === 0) {
    throw new Error("Expected the scale-bank write range to contain a header and rows.");
  }
  return rows.map((row) => Object.fromEntries(header.map((key, index) => [String(key), row[index] ?? null])));
}

const table = tableFromPlan(compiled.plan);
const reverseKeyedItems = table
  .filter((row) => row.Reverse === true)
  .map((row) => ({
    constructCode: row["Construct Code"],
    itemCode: row["Item Code"],
    itemText: row["Item Text"],
  }));
const constructSummary = intent.constructs.map((construct) => ({
  code: construct.code,
  name: construct.name,
  scale: construct.scale,
  itemCount: construct.items.length,
  reverseItemCodes: construct.items.filter((item) => item.reverse === true).map((item) => item.code),
}));

const emptyWorkbook = createEmptyWorkbook(compiled.plan.target.workbook);
const preview = memoryAdapter.preview(compiled.plan, emptyWorkbook, {
  executor: EXECUTOR,
  now: () => PREVIEW_AT,
});
const memoryApply = memoryAdapter.apply(compiled.plan, emptyWorkbook, {
  executor: EXECUTOR,
  now: () => PREVIEW_AT,
});

const artifact = {
  schemaVersion: "opensheet.example-artifact.v1",
  example: "service-quality",
  provenance: {
    label: "demonstration",
    statement: "Illustrative multi-factor scale-bank items; not a validated measurement instrument.",
    itemSources: "demonstration-only; no citation supplied",
    execution: "local memory adapter",
    network: false,
    model: false,
    credentials: false,
    nativeExcelOrGoogleSheets: false,
  },
  intent,
  plan: compiled.plan,
  planDigest: compiled.digest,
  summary: {
    ...compiled.summary,
    constructCount: intent.constructs.length,
    itemCount: table.length,
    reverseKeyedItemCount: reverseKeyedItems.length,
  },
  constructs: constructSummary,
  reverseKeyedItems,
  table,
  preview: preview.receipt,
  memoryApply: memoryApply.receipt,
  memorySnapshot: memoryApply.snapshot,
};

process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
