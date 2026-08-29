#!/usr/bin/env node

import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const requiredFiles = [
  "package.json",
  "LICENSE",
  "README.md",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/cli.js",
  "dist/adapters/memory.js",
  "dist/adapters/memory.d.ts",
  "dist/adapters/xlsx.js",
  "dist/adapters/xlsx.d.ts",
  "schemas/plan.v1.schema.json",
  "schemas/receipt.v1.schema.json",
  "schemas/capability.v1.schema.json",
  "schemas/snapshot.v1.schema.json",
  "schemas/intent.scale-bank.v1.schema.json",
  "schemas/intent.gap-map.v1.schema.json",
  "schemas/intent.kpi-threshold.v1.schema.json",
  "examples/scale-bank.json",
  "examples/gap-map.json",
];

const importProbe = `
  const fs = await import("node:fs");
  const modules = {
    root: await import("opensheet-ai"),
    memory: await import("opensheet-ai/memory"),
    xlsx: await import("opensheet-ai/xlsx"),
  };
  const requiredExports = {
    root: ["compilePlan", "compileScaleBank", "assertSheetPlan"],
    memory: ["createEmptyWorkbook", "executeInMemory", "memoryAdapter", "MEMORY_CAPABILITY"],
    xlsx: ["executeXlsx", "xlsxAdapter", "XLSX_CAPABILITY"],
  };
  for (const [moduleName, names] of Object.entries(requiredExports)) {
    for (const name of names) {
      if (!(name in modules[moduleName])) {
        throw new Error("Missing public export " + moduleName + "." + name);
      }
    }
  }
  const compiled = modules.root.compileScaleBank({
    module: "scale-bank",
    version: 1,
    workbook: "clean-room-import",
    constructs: [{
      code: "T",
      name: "T",
      scale: { min: 1, max: 5 },
      items: [{ code: "T1", text: "Clean room import item" }],
    }],
  });
  const memoryResult = modules.memory.executeInMemory(
    compiled.plan,
    modules.memory.createEmptyWorkbook("clean-room-import"),
    { now: () => "2026-08-24T00:00:00.000Z" },
  );
  if (memoryResult.receipt.status !== "dry-run") {
    throw new Error("Unexpected memory smoke status: " + memoryResult.receipt.status);
  }
  if (modules.memory.MEMORY_CAPABILITY.adapterId !== "opensheet-ai/memory") {
    throw new Error("Memory capability identity is not package-stable");
  }
  if (modules.xlsx.XLSX_CAPABILITY.adapterId !== "opensheet-ai/xlsx") {
    throw new Error("XLSX capability identity is not package-stable");
  }
  const xlsxPath = process.cwd() + "/clean-room-smoke.xlsx";
  const xlsxResult = await modules.xlsx.executeXlsx(compiled.plan, {
    outputPath: xlsxPath,
    dryRun: false,
    now: () => "2026-08-24T00:00:00.000Z",
  });
  if (xlsxResult.receipt.status !== "applied" || !fs.existsSync(xlsxPath)) {
    throw new Error("XLSX public export did not write an applied clean-room workbook");
  }
`;

let directory;
let tarballPath;
let failure;

try {
  const pack = spawnSync("npm", ["pack", "--silent"], { cwd: root, encoding: "utf8" });
  if (pack.status !== 0) {
    throw new Error(pack.stderr || pack.stdout || "npm pack failed");
  }

  const tarballName = pack.stdout.trim().split(/\r?\n/).at(-1);
  if (!tarballName?.endsWith(".tgz")) {
    throw new Error(`unexpected pack output: ${pack.stdout}`);
  }
  tarballPath = join(root, tarballName);

  directory = await mkdtemp(join(tmpdir(), "opensheet-clean-"));
  const consumerRoot = join(directory, "consumer");
  await mkdir(consumerRoot);
  await writeFile(
    join(consumerRoot, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );

  const install = spawnSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      "--omit=dev",
      "--prefix",
      consumerRoot,
      tarballPath,
    ],
    { cwd: directory, encoding: "utf8" },
  );
  if (install.status !== 0) {
    throw new Error(`${install.stderr || ""}${install.stdout || ""}package install failed`);
  }

  const packageRoot = join(consumerRoot, "node_modules", "opensheet-ai");
  const listing = await readdir(packageRoot);
  if (!listing.includes("dist") || listing.includes("src") || listing.includes("docs")) {
    throw new Error(`clean-room install contents unexpected: ${listing.join(", ")}`);
  }

  const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  const missing = [];
  for (const path of requiredFiles) {
    try {
      await access(join(packageRoot, path));
    } catch {
      missing.push(path);
    }
  }
  for (const [subpath, target] of Object.entries(packageJson.exports ?? {})) {
    for (const condition of ["default", "types"]) {
      const exportTarget = target?.[condition];
      if (typeof exportTarget !== "string") {
        throw new Error(`Export ${subpath} is missing ${condition} target`);
      }
      try {
        await access(join(packageRoot, exportTarget));
      } catch {
        missing.push(exportTarget.replace(/^\.\//, ""));
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(`clean-room install missing required files:\n${missing.join("\n")}`);
  }

  const importResult = spawnSync(process.execPath, ["--input-type=module", "-e", importProbe], {
    cwd: consumerRoot,
    encoding: "utf8",
  });
  if (importResult.status !== 0) {
    throw new Error(
      `${importResult.stderr || ""}${importResult.stdout || ""}clean-room public export import failed (status ${String(importResult.status)})`,
    );
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
  const cliResult = spawnSync(process.execPath, [join(packageRoot, "dist/cli.js"), "compile", intentPath], {
    cwd: consumerRoot,
    encoding: "utf8",
  });
  if (cliResult.status !== 0 || !cliResult.stdout.includes("opensheet.plan.v1")) {
    throw new Error(
      `${cliResult.stderr || ""}${cliResult.stdout || ""}clean-room CLI compile failed (status ${String(cliResult.status)})`,
    );
  }

  process.stdout.write("clean-room pack/install/import: pass\n");
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  if (tarballPath) {
    await rm(tarballPath, { force: true });
  }
  if (directory) {
    await rm(directory, { recursive: true, force: true });
  }
}

if (failure) {
  process.stderr.write(`${failure}\n`);
  process.exitCode = 1;
}
