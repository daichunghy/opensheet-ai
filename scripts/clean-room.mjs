#!/usr/bin/env node

import { mkdtemp, rm, writeFile, readdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pack = spawnSync("npm", ["pack", "--silent"], { cwd: root, encoding: "utf8" });
if (pack.status !== 0) {
  process.stderr.write(pack.stderr || "npm pack failed\n");
  process.exit(1);
}

const tarballName = pack.stdout.trim().split("\n").at(-1);
if (!tarballName?.endsWith(".tgz")) {
  process.stderr.write(`unexpected pack output: ${pack.stdout}\n`);
  process.exit(1);
}

const directory = await mkdtemp(join(tmpdir(), "opensheet-clean-"));
const extract = spawnSync("tar", ["-xzf", join(root, tarballName), "-C", directory], {
  encoding: "utf8",
});
if (extract.status !== 0) {
  process.stderr.write(extract.stderr || "tar extract failed\n");
  process.exit(1);
}

const packageRoot = join(directory, "package");
const listing = await readdir(packageRoot);
if (!listing.includes("dist") || listing.includes("src") || listing.includes("docs")) {
  process.stderr.write(`clean-room pack contents unexpected: ${listing.join(", ")}\n`);
  process.exit(1);
}

const intent = {
  module: "scale-bank",
  version: 1,
  workbook: "clean-room",
  constructs: [
    {
      code: "T",
      name: "T",
      scale: { min: 1, max: 5 },
      items: [{ code: "T1", text: "Clean room item" }],
    },
  ],
};
const intentPath = join(directory, "intent.json");
await writeFile(intentPath, JSON.stringify(intent));
await symlink(join(root, "node_modules"), join(packageRoot, "node_modules"), "dir");

const result = spawnSync(process.execPath, [join(packageRoot, "dist/cli.js"), "compile", intentPath], {
  cwd: packageRoot,
  encoding: "utf8",
});

await rm(join(root, tarballName), { force: true });
await rm(directory, { recursive: true, force: true });

if (result.status !== 0 || !result.stdout.includes("opensheet.plan.v1")) {
  process.stderr.write(
    `${result.stderr || ""}${result.stdout || ""}clean-room compile failed (status ${String(result.status)})\n`,
  );
  process.exit(1);
}

process.stdout.write("clean-room pack: pass\n");
