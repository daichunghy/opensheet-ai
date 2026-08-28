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
import type { CompiledPlan, ExecutionReceipt } from "./core/types.js";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compileIntent(input: unknown): CompiledPlan {
  if (!isRecord(input) || !("module" in input)) {
    throw new Error("Intent must be an object with a module field.");
  }
  switch (input["module"]) {
    case "scale-bank":
      return compileScaleBank(input);
    case "gap-map":
      return compileGapMap(input);
    case "kpi-threshold":
      return compileKpiThreshold(input);
    default:
      throw new Error(`Unsupported intent module: ${String(input["module"])}`);
  }
}

function optionValue(args: readonly string[], option: string, usage: string): string | undefined {
  const index = args.indexOf(option);
  if (index < 0) {
    return undefined;
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires ${usage}.`);
  }
  return value;
}

type PreviewFormat = "json" | "text";

function previewFormat(args: readonly string[]): PreviewFormat {
  const format = optionValue(args, "--format", "json or text");
  if (format === undefined || format === "json") {
    return "json";
  }
  if (format === "text") {
    return "text";
  }
  throw new Error("--format must be either 'json' or 'text'.");
}

function formatPreviewText(
  inputPath: string,
  compiled: CompiledPlan,
  receipt: ExecutionReceipt,
): string {
  const { source, target } = compiled.plan;
  const { summary } = compiled;
  const sheets = summary.sheets.length > 0 ? summary.sheets.join(", ") : "none";
  const lines = [
    "OpenSheet-AI preview",
    `Intent/source: ${source.module} v${source.version} (${inputPath})`,
    `Workbook: ${target.workbook}`,
    `Plan: ${summary.operationCount} operation(s), ${summary.touchedCellCount} touched cell(s), sheet(s): ${sheets}, formula writes: ${summary.containsFormulaWrites ? "yes" : "no"}.`,
    `Receipt status: ${receipt.status}`,
    `Plan digest: ${compiled.digest}`,
  ];

  if (receipt.status === "dry-run") {
    lines.push(
      `Workbook state: unchanged; projected state digest: ${receipt.projectedAfterDigest ?? "not available"}.`,
    );
  } else if (receipt.status === "blocked") {
    lines.push("Workbook state: unchanged; no operations were applied.");
  } else {
    lines.push(`Workbook state: ${receipt.afterDigest}.`);
  }

  if (receipt.findings.length > 0) {
    lines.push("", "Findings:");
    receipt.findings.forEach((finding) => {
      lines.push(`- ${finding.code}: ${finding.message}`);
    });
  }

  lines.push(
    "",
    receipt.status === "blocked"
      ? "Output: blocked preview; the workbook was not changed."
      : "Output: concise text summary; the workbook was not changed.",
    receipt.status === "blocked"
      ? "Next step: resolve the finding(s) above and run preview again."
      : "Next step: review the proposed plan; use --format json for the full machine-readable plan and receipt.",
  );
  return `${lines.join("\n")}\n`;
}

function help(stdout: NodeJS.WritableStream): void {
  stdout.write(`OpenSheet-AI foundation CLI

Usage:
  opensheet-ai compile <intent.json>
  opensheet-ai preview <intent.json> [--format json|text] [--in <workbook.json>] [--print-workbook]
  opensheet-ai validate <plan.json>
  opensheet-ai apply-memory <plan.json> [workbook.json] [--apply] [--print-workbook]
  opensheet-ai apply-xlsx <plan.json> --out <file.xlsx> [--in <file.xlsx>] [--apply] [--overwrite] [--allow-sheet Name]
  opensheet-ai verify-receipt <receipt.json> <plan.json> [workbook.json]

compile accepts module=scale-bank, module=gap-map, or module=kpi-threshold.
preview accepts the same typed intent JSON directly and returns the compiled plan, digest, summary, and memory dry-run receipt. Use --format text for a concise human-readable summary; JSON is the default.
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
    print(compileIntent(await readJson(inputPath)).plan, io.stdout);
    return 0;
  }

  if (command === "preview") {
    const compiled = compileIntent(await readJson(inputPath));
    const format = previewFormat(rest);
    const workbookPath = optionValue(rest, "--in", "<workbook.json>");
    const printWorkbook = rest.includes("--print-workbook");
    const workbook = workbookPath
      ? parseMemoryWorkbook(await readJson(workbookPath))
      : createEmptyWorkbook(compiled.plan.target.workbook);
    const result = executeInMemory(compiled.plan, workbook, { dryRun: true });
    if (format === "text") {
      io.stdout.write(formatPreviewText(inputPath, compiled, result.receipt));
    } else {
      print(
        {
          plan: compiled.plan,
          planDigest: compiled.digest,
          summary: compiled.summary,
          receipt: result.receipt,
          ...(printWorkbook ? { workbook: result.workbook } : {}),
        },
        io.stdout,
      );
    }
    return result.receipt.status === "blocked" ? 1 : 0;
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
