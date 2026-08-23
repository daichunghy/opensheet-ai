#!/usr/bin/env node

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const skipDirectories = new Set(["node_modules", "dist", ".git", "coverage"]);
const patterns = [
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN CERTIFICATE-----/,
];
const skipFiles = new Set(["LICENSE", "check-secrets.mjs"]);

async function walk(directory, found) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirectories.has(entry.name)) {
        await walk(path, found);
      }
      continue;
    }
    if (skipFiles.has(entry.name) || entry.name.endsWith(".pem")) {
      if (entry.name.endsWith(".pem")) {
        found.push(relative(root, path));
      }
      continue;
    }
    const info = await stat(path);
    if (info.size > 1_000_000) {
      continue;
    }
    const text = await readFile(path, "utf8");
    if (patterns.some((pattern) => pattern.test(text))) {
      found.push(relative(root, path));
    }
  }
}

const found = [];
await walk(root, found);
if (found.length > 0) {
  process.stderr.write(`Secret-like files:\n${found.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write("secret scan: pass\n");
