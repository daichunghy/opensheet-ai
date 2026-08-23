#!/usr/bin/env node

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const SIZE_CEILING_BYTES = 128 * 1024;

async function collectJs(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJs(path)));
    } else if (entry.name.endsWith(".js")) {
      files.push(path);
    }
  }
  return files;
}

const files = await collectJs(dist);
let total = 0;
for (const file of files) {
  total += (await stat(file)).size;
}

const cold = spawnSync(
  process.execPath,
  [
    "--input-type=module",
    "-e",
    "const t = performance.now(); await import('./dist/index.js'); process.stdout.write(String(Math.round(performance.now() - t)));",
  ],
  { cwd: root, encoding: "utf8" },
);

if (cold.status !== 0) {
  process.stderr.write(cold.stderr ?? "cold import failed\n");
  process.exit(1);
}

const report = {
  distJsBytes: total,
  distJsKiB: Number((total / 1024).toFixed(2)),
  fileCount: files.length,
  sizeCeilingBytes: SIZE_CEILING_BYTES,
  coldImportMs: Number(cold.stdout),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (total > SIZE_CEILING_BYTES) {
  process.stderr.write(`dist JS ${total} bytes exceeds ceiling ${SIZE_CEILING_BYTES}\n`);
  process.exit(1);
}
