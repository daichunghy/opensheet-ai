#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: root,
  encoding: "utf8",
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || "npm pack failed\n");
  process.exit(1);
}

const jsonStart = result.stdout.indexOf("[");
const jsonText = jsonStart >= 0 ? result.stdout.slice(jsonStart) : result.stdout;
const payload = JSON.parse(jsonText);
const files = (Array.isArray(payload) ? payload[0]?.files : payload?.files) ?? [];
const paths = files.map((file) => file.path ?? file).sort();

if (paths.length === 0) {
  process.stderr.write("npm pack --json returned no files; falling back to text parse is not implemented.\n");
  process.exit(1);
}

const allowed = /^(package\.json|LICENSE|README\.md|dist\/|schemas\/|examples\/)/;
const forbidden = paths.filter((path) => !allowed.test(path));
if (forbidden.length > 0) {
  process.stderr.write(`Packed unexpected files:\n${forbidden.join("\n")}\n`);
  process.exit(1);
}

const required = [
  "package.json",
  "LICENSE",
  "README.md",
  "dist/index.js",
  "dist/cli.js",
  "dist/adapters/memory.js",
  "dist/adapters/xlsx.js",
  "schemas/plan.v1.schema.json",
  "schemas/receipt.v1.schema.json",
  "schemas/capability.v1.schema.json",
  "schemas/snapshot.v1.schema.json",
  "schemas/intent.scale-bank.v1.schema.json",
  "schemas/intent.gap-map.v1.schema.json",
  "schemas/intent.kpi-threshold.v1.schema.json",
  "examples/scale-bank.json",
  "examples/gap-map.json",
  "examples/inventory-revenue/sample.xlsx",
  "examples/service-quality/sample.xlsx",
];
const missing = required.filter((path) => !paths.includes(path));
if (missing.length > 0) {
  process.stderr.write(`Packed archive missing required files:\n${missing.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`${JSON.stringify({ fileCount: paths.length, files: paths }, null, 2)}\n`);
