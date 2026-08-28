#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { compileKpiThreshold } from "opensheet-ai";
import { createEmptyWorkbook, memoryAdapter } from "opensheet-ai/memory";

const PREVIEW_AT = "2026-08-27T00:00:00.000Z";
const EXECUTOR = "opensheet-ai/example/inventory-revenue";
const intent = JSON.parse(await readFile(new URL("./intent.json", import.meta.url), "utf8"));
const compiled = compileKpiThreshold(intent);

function tableFromPlan(plan) {
  const write = plan.operations.find((operation) => operation.kind === "write-range");
  if (!write || write.kind !== "write-range") {
    throw new Error("Expected the kpi-threshold plan to contain a write-range operation.");
  }
  const [header, ...rows] = write.values;
  if (!header || rows.length === 0) {
    throw new Error("Expected the kpi-threshold write range to contain a header and rows.");
  }
  return rows.map((row) => Object.fromEntries(header.map((key, index) => [String(key), row[index] ?? null])));
}

const preview = memoryAdapter.preview(
  compiled.plan,
  createEmptyWorkbook(compiled.plan.target.workbook),
  { executor: EXECUTOR, now: () => PREVIEW_AT },
);
const memoryApply = memoryAdapter.apply(
  compiled.plan,
  createEmptyWorkbook(compiled.plan.target.workbook),
  { executor: EXECUTOR, now: () => PREVIEW_AT },
);

const artifact = {
  schemaVersion: "opensheet.example-artifact.v1",
  example: "inventory-revenue",
  intent,
  plan: compiled.plan,
  planDigest: compiled.digest,
  summary: compiled.summary,
  table: tableFromPlan(compiled.plan),
  preview: preview.receipt,
  memoryApply: memoryApply.receipt,
  memorySnapshot: memoryApply.snapshot,
};

process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
