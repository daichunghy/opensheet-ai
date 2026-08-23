#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createEmptyWorkbook,
  executeInMemory,
  parseMemoryWorkbook,
  projectMemoryWorkbook,
} from "./adapters/memory.js";
import { executeXlsx } from "./adapters/xlsx.js";
import { compilePlan } from "./core/plan.js";
import { verifyReceipt } from "./core/receipt.js";
import type { ExecutionReceipt } from "./core/types.js";
import { compileGapMap } from "./modules/gap-map.js";
import { compileKpiThreshold } from "./modules/kpi-threshold.js";
import { compileScaleBank } from "./modules/scale-bank.js";

const MAX_JSON_BYTES = 2 * 1024 * 1024;

export async function readJson(path: string): Promise<unknown> {
  const resolved = resolve(path);
  const info = await stat(resolved);
  if (info.size > MAX_JSON_BYTES) {
    throw new Error(`JSON file exceeds the ${MAX_JSON_BYTES} byte limit: ${path}`);
  }
  return JSON.parse(await readFile(resolved, "utf8")) as unknown;
}

function print(value: unknown, stdout: NodeJS.WritableStream): void {
  stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function help(stdout: NodeJS.WritableStream): void {
  stdout.write(`OpenSheet-AI foundation CLI

Usage:
  opensheet-ai compile <intent.json>
  opensheet-ai validate <plan.json>
  opensheet-ai apply-memory <plan.json> [workbook.json] [--apply] [--print-workbook]
  opensheet-ai apply-xlsx <plan.json> --out <file.xlsx> [--in <file.xlsx>] [--apply] [--overwrite] [--allow-sheet Name]
  opensheet-ai verify-receipt <receipt.json> <plan.json> [workbook.json]

compile accepts module=scale-bank, module=gap-map, or module=kpi-threshold.
apply-memory and apply-xlsx are dry-run by default; --apply writes a cloned workbook or a new .xlsx file.
Output is the receipt. Add --print-workbook to include the in-memory workbook object.
validate uses compilePlan, not a JSON Schema engine.
`);
}

export async function runCli(
  argv: readonly string[],
  io: { stdout: NodeJS.WritableStream; stderr: NodeJS.WritableStream } = process,
): Promise<number> {
  const [command, inputPath, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    help(io.stdout);
    return 0;
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
      print(compileScaleBank(intent).plan, io.stdout);
      return 0;
    }
    if (moduleName === "gap-map") {
      print(compileGapMap(intent).plan, io.stdout);
      return 0;
    }
    if (moduleName === "kpi-threshold") {
      print(compileKpiThreshold(intent).plan, io.stdout);
      return 0;
    }
    throw new Error(`Unsupported intent module: ${String(moduleName)}`);
  }

  if (command === "validate") {
    const compiled = compilePlan(await readJson(inputPath));
    print({ digest: compiled.digest, summary: compiled.summary }, io.stdout);
    return 0;
  }

  if (command === "apply-memory") {
    const compiled = compilePlan(await readJson(inputPath));
    const apply = rest.includes("--apply");
    const printWorkbook = rest.includes("--print-workbook");
    const workbookPath = rest.find(
      (argument) => argument !== "--apply" && argument !== "--print-workbook",
    );
    const workbook = workbookPath
      ? parseMemoryWorkbook(await readJson(workbookPath))
      : createEmptyWorkbook(compiled.plan.target.workbook);
    const result = executeInMemory(compiled.plan, workbook, { dryRun: !apply });
    print(printWorkbook ? result : result.receipt, io.stdout);
    return 0;
  }

  if (command === "apply-xlsx") {
    const compiled = compilePlan(await readJson(inputPath));
    const outIndex = rest.indexOf("--out");
    const outputPath = outIndex >= 0 ? rest[outIndex + 1] : undefined;
    if (!outputPath) {
      throw new Error("apply-xlsx requires --out <file.xlsx>.");
    }
    const inIndex = rest.indexOf("--in");
    const inputWorkbook = inIndex >= 0 ? rest[inIndex + 1] : undefined;
    const allowedSheets: string[] = [];
    rest.forEach((argument, index) => {
      const name = rest[index + 1];
      if (argument === "--allow-sheet" && name && !name.startsWith("--")) {
        allowedSheets.push(name);
      }
    });
    const result = await executeXlsx(compiled.plan, {
      outputPath,
      dryRun: !rest.includes("--apply"),
      overwrite: rest.includes("--overwrite"),
      ...(inputWorkbook ? { inputPath: inputWorkbook } : {}),
      ...(allowedSheets.length > 0 ? { allowedSheets } : {}),
    });
    print(result.receipt, io.stdout);
    return result.receipt.status === "blocked" ? 1 : 0;
  }

  if (command === "verify-receipt") {
    const receipt = (await readJson(inputPath)) as ExecutionReceipt;
    const planPath = rest[0];
    if (!planPath) {
      throw new Error("verify-receipt requires a plan path.");
    }
    const compiled = compilePlan(await readJson(planPath));
    const workbookPath = rest[1];
    const beforeWorkbook = workbookPath
      ? parseMemoryWorkbook(await readJson(workbookPath))
      : createEmptyWorkbook(compiled.plan.target.workbook);
    const idempotent = Array.isArray(receipt.findings)
      ? receipt.findings.some((item) => item.code === "idempotent_replay")
      : false;
    const afterWorkbook =
      receipt.status === "applied" && !idempotent
        ? projectMemoryWorkbook(compiled.plan, beforeWorkbook)
        : beforeWorkbook;
    const verification = verifyReceipt({
      receipt,
      plan: compiled.plan,
      beforeWorkbook,
      afterWorkbook,
      ...(receipt.status === "dry-run" ? { dryRun: true } : {}),
    });
    print(verification, io.stdout);
    return verification.status === "fail" ? 1 : 0;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function main(argv: readonly string[]): Promise<void> {
  try {
    process.exitCode = await runCli(argv);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

function invokedDirectly(): boolean {
  if (process.argv[1] === undefined) {
    return false;
  }
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
  }
}

if (invokedDirectly()) {
  void main(process.argv.slice(2));
}
