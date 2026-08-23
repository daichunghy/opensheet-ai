#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, "opensheet-ai-session.tgz");
const staging = await mkdtemp(join(tmpdir(), "opensheet-session-"));

const copy = spawnSync(
  "rsync",
  [
    "-a",
    "--exclude",
    "node_modules",
    "--exclude",
    ".git",
    "--exclude",
    "dist",
    "--exclude",
    "*.tgz",
    "--exclude",
    ".DS_Store",
    `${root}/`,
    `${staging}/opensheet-ai/`,
  ],
  { encoding: "utf8" },
);
if (copy.status !== 0) {
  process.stderr.write(copy.stderr || "rsync failed; need rsync on macOS\n");
  process.exit(1);
}

const tar = spawnSync("tar", ["-czf", out, "-C", staging, "opensheet-ai"], { encoding: "utf8" });
await rm(staging, { recursive: true, force: true });
if (tar.status !== 0) {
  process.stderr.write(tar.stderr || "tar failed\n");
  process.exit(1);
}

process.stdout.write(`session pack: ${out}\nGive this file only to a person on the call. Do not attach it to a public issue.\n`);
