#!/usr/bin/env node

import { mkdtemp, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const cli = join(root, "dist/cli.js");

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || args.join(" "));
  }
  return result.stdout;
}

const directory = await mkdtemp(join(tmpdir(), "opensheet-qs-"));

async function session(label, example) {
  const compiled = run(["compile", example]);
  const planPath = join(directory, `${label}.json`);
  await writeFile(planPath, compiled);
  const validated = JSON.parse(run(["validate", planPath]));
  const preview = JSON.parse(run(["apply-memory", planPath]));
  const xlsxPath = join(directory, `${label}.xlsx`);
  run(["apply-xlsx", planPath, "--out", xlsxPath, "--apply"]);
  await stat(xlsxPath);
  return {
    host: "local-operator",
    external: false,
    example,
    digest: validated.digest,
    previewStatus: preview.status,
    xlsxWritten: true,
  };
}

const reports = [
  await session("session-1", "examples/scale-bank.json"),
  await session("session-2", "examples/gap-map.json"),
];
await rm(directory, { recursive: true, force: true });

if (reports.some((item) => item.previewStatus !== "dry-run" || !item.xlsxWritten)) {
  process.stderr.write("quickstart sessions failed\n");
  process.exit(1);
}

process.stdout.write(`${JSON.stringify({ sessions: reports }, null, 2)}\n`);
process.stdout.write("quickstart sessions: pass (local operator, not external)\n");
