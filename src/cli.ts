#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createEmptyWorkbook, executeInMemory, type MemoryWorkbook } from "./adapters/memory.js";
import { compilePlan } from "./core/plan.js";
import { compileGapMap, type GapMapIntent } from "./modules/gap-map.js";
import { compileScaleBank, type ScaleBankIntent } from "./modules/scale-bank.js";

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function help(): void {
  process.stdout.write(`OpenSheet-AI foundation CLI

Usage:
  opensheet-ai compile <intent.json>
  opensheet-ai validate <plan.json>
  opensheet-ai apply-memory <plan.json> [workbook.json] [--apply]

compile accepts module=scale-bank or module=gap-map.
apply-memory is dry-run by default; --apply returns the changed in-memory workbook.
`);
}

async function main(argv: readonly string[]): Promise<void> {
  const [command, inputPath, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    help();
    return;
  }
  if (!inputPath) {
    throw new Error(`${command} requires an input path.`);
  }

  if (command === "compile") {
    const intent = await readJson(inputPath);
    if (typeof intent !== "object" || intent === null || !("module" in intent)) {
      throw new Error("Intent must be an object with a module field.");
    }
    const moduleName = (intent as { module?: unknown }).module;
    if (moduleName === "scale-bank") {
      print(compileScaleBank(intent as ScaleBankIntent).plan);
      return;
    }
    if (moduleName === "gap-map") {
      print(compileGapMap(intent as GapMapIntent).plan);
      return;
    }
    throw new Error(`Unsupported intent module: ${String(moduleName)}`);
  }

  if (command === "validate") {
    const compiled = compilePlan(await readJson(inputPath));
    print({ digest: compiled.digest, summary: compiled.summary });
    return;
  }

  if (command === "apply-memory") {
    const compiled = compilePlan(await readJson(inputPath));
    const apply = rest.includes("--apply");
    const workbookPath = rest.find((argument) => argument !== "--apply");
    const workbook = workbookPath
      ? ((await readJson(workbookPath)) as MemoryWorkbook)
      : createEmptyWorkbook(compiled.plan.target.workbook);
    print(executeInMemory(compiled.plan, workbook, { dryRun: !apply }));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
