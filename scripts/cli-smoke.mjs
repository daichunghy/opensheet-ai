#!/usr/bin/env node

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const cli = join(root, "dist/cli.js");

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `cli failed: ${args.join(" ")}\n`);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

const scale = run(["compile", "examples/scale-bank.json"]);
const gap = run(["compile", "examples/gap-map.json"]);
const kpi = run(["compile", "examples/kpi-threshold.json"]);
if (
  !scale.includes("opensheet.plan.v1") ||
  !gap.includes("opensheet.plan.v1") ||
  !kpi.includes("opensheet.plan.v1")
) {
  process.stderr.write("compile did not emit opensheet.plan.v1\n");
  process.exit(1);
}

const directory = await mkdtemp(join(tmpdir(), "opensheet-smoke-"));
const scalePlan = join(directory, "scale.json");
const gapPlan = join(directory, "gap.json");
await writeFile(scalePlan, scale);
await writeFile(gapPlan, gap);

const validated = JSON.parse(run(["validate", scalePlan]));
if (!String(validated.digest).startsWith("sha256:")) {
  process.stderr.write("validate missing digest\n");
  process.exit(1);
}

const memory = JSON.parse(run(["apply-memory", scalePlan]));
if (memory.status !== "dry-run" || memory.workbook) {
  process.stderr.write("apply-memory should print a dry-run receipt only\n");
  process.exit(1);
}

const xlsxOut = join(directory, "preview.xlsx");
const xlsx = JSON.parse(run(["apply-xlsx", scalePlan, "--out", xlsxOut]));
if (xlsx.status !== "dry-run") {
  process.stderr.write("apply-xlsx dry-run should not apply\n");
  process.exit(1);
}

await rm(directory, { recursive: true, force: true });
process.stdout.write("cli smoke: pass\n");
