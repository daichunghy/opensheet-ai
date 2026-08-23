#!/usr/bin/env node

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const { compilePlan } = await import(pathToFileURL(join(root, "dist/index.js")).href);
const { createEmptyWorkbook, executeInMemory } = await import(
  pathToFileURL(join(root, "dist/adapters/memory.js")).href
);
const { executeXlsx } = await import(pathToFileURL(join(root, "dist/adapters/xlsx.js")).href);

const fixtures = [
  "ensure-write.plan.json",
  "literal-equals.plan.json",
  "formula-blocked.plan.json",
];
const directory = join(root, "test/fixtures/conformance");
const now = () => "2026-08-23T00:00:00.000Z";
const scratch = await mkdtemp(join(tmpdir(), "opensheet-conform-"));

for (const name of fixtures) {
  const plan = compilePlan(JSON.parse(await readFile(join(directory, name), "utf8"))).plan;
  const memory = executeInMemory(plan, createEmptyWorkbook(plan.target.workbook), {
    dryRun: name === "formula-blocked.plan.json",
    now,
  });
  if (name === "formula-blocked.plan.json" && memory.receipt.status !== "blocked") {
    process.stderr.write(`${name}: memory should block formulas\n`);
    process.exit(1);
  }
  if (name !== "formula-blocked.plan.json" && memory.receipt.status === "blocked") {
    process.stderr.write(`${name}: memory blocked unexpectedly\n`);
    process.exit(1);
  }
  const xlsx = await executeXlsx(plan, {
    outputPath: join(scratch, `${name}.xlsx`),
    dryRun: true,
    now,
  });
  if (name === "formula-blocked.plan.json" && xlsx.receipt.status !== "blocked") {
    process.stderr.write(`${name}: xlsx should block formulas\n`);
    process.exit(1);
  }
}

await rm(scratch, { recursive: true, force: true });
process.stdout.write("conformance harness: pass\n");
