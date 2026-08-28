#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = fileURLToPath(new URL("..", import.meta.url));

export const REQUIRED_REPOSITORY_FILES = [
  "package.json",
  "package-lock.json",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "docs/first-use.md",
  "docs/release-and-rollback.md",
  "examples/inventory-revenue/sample.xlsx",
  "examples/service-quality/sample.xlsx",
];

export const REQUIRED_PACK_FILES = [
  "package.json",
  "README.md",
  "LICENSE",
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
  "examples/kpi-threshold.json",
  "examples/inventory-revenue/guide.md",
  "examples/inventory-revenue/intent.json",
  "examples/inventory-revenue/sample.xlsx",
  "examples/service-quality/guide.md",
  "examples/service-quality/intent.json",
  "examples/service-quality/sample.xlsx",
];

const FORBIDDEN_PACK_ROOTS = ["src", "test", "fixtures", "scripts"];
const ALPHA_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-alpha(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]+))*(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const PLATFORM_TERMS = "(?:Excel(?:\\s+Desktop)?|Google\\s+Sheets)";
const PRODUCT_SUBJECT = "(?:OpenSheet(?:-AI)?|this (?:project|package|release|alpha)|the (?:project|package|release|adapter)|our (?:project|package|release|adapter)|it)";
const PROHIBITED_DOCUMENTATION_PATTERNS = [
  {
    kind: "native-spreadsheet-claim",
    pattern: new RegExp(`\\b${PRODUCT_SUBJECT}\\b[^.!?]{0,100}\\b(?:supports?|connects?|integrates?|writes?|reads?|runs?|executes?|provides?|offers?|ships?|has|includes?)\\b[^.!?]{0,100}\\b(?:native\\s+|live\\s+|direct\\s+|end[- ]to[- ]end\\s+)?${PLATFORM_TERMS}\\b`, "i"),
  },
  {
    kind: "native-spreadsheet-claim",
    pattern: new RegExp(`\\b${PRODUCT_SUBJECT}\\b[^.!?]{0,100}\\b(?:native|live|direct|end[- ]to[- ]end)\\b[^.!?]{0,70}\\b${PLATFORM_TERMS}\\b`, "i"),
  },
  {
    kind: "native-spreadsheet-claim",
    pattern: new RegExp(`^\\s*(?:[-*]\\s*)?(?:supports?|connects?|integrates?|writes?|reads?|runs?|executes?|provides?|offers?|ships?)\\b[^.!?]{0,90}\\b(?:native\\s+|live\\s+|direct\\s+|end[- ]to[- ]end\\s+)?${PLATFORM_TERMS}\\b`, "i"),
  },
  {
    kind: "native-spreadsheet-claim",
    pattern: new RegExp(`^\\s*(?:[-*]\\s*)?\\b(?:native|live|direct|end[- ]to[- ]end)\\b[^.!?]{0,80}\\b${PLATFORM_TERMS}\\b`, "i"),
  },
  {
    kind: "adoption-claim",
    pattern: new RegExp(`\\b${PRODUCT_SUBJECT}\\b[^.!?]{0,90}\\b(?:is|was|has been|became|becomes)\\b[^.!?]{0,50}\\b(?:adopted|used|deployed|in production)\\b`, "i"),
  },
  {
    kind: "adoption-claim",
    pattern: /^(?:\s*[-*]\s*)?\b(?:adopted|used|deployed)\s+by\s+(?:\d+\s+)?(?:external\s+|independent\s+|downstream\s+|customer\s+)?(?:users?|teams?|developers?|projects?|repositories?|applications?|customers?|organizations?)\b/i,
  },
  {
    kind: "adoption-claim",
    pattern: new RegExp(`\\b(?:external|independent|downstream)\\s+(?:users?|teams?|developers?|projects?|repositories?|applications?)\\b[^.!?]{0,70}\\b(?:use|using|adopt|integrat|deploy|run)\\b`, "i"),
  },
  {
    kind: "adoption-claim",
    pattern: new RegExp(`\\b${PRODUCT_SUBJECT}\\b[^.!?]{0,50}\\b(?:have|has|show|shows|serve|serves)\\b[^.!?]{0,50}\\b(?:external\\s+)?(?:adoption|users?|customers?|teams?)\\b`, "i"),
  },
  {
    kind: "adoption-claim",
    pattern: /\b(?:pilot|beta|trial)\b[^.!?]{0,60}\b(?:is|was|has been|completed|successful|validated|concluded|deployed|in production)\b/i,
  },
  {
    kind: "adoption-claim",
    pattern: /\b(?:adoption|usage)\b[^.!?]{0,50}\b(?:is|was|has been)\b[^.!?]{0,50}\b(?:verified|proven|confirmed|strong|growing|real|active)\b/i,
  },
];

const NEGATION_PATTERN = /\b(?:not|no|never|without|unproven|unverified|unconfirmed|unsupported|deferred|pending|planned|future|cannot|can't|doesn['’]?t|do(?:es)?\s+not|not\s+yet|will|would|could|may|should|shall|later|roadmap|goal|target|criteria)\b/i;
const POST_NEGATION_PATTERN = /\b(?:is|are|was|were|remain|remains|has|have)\b\s+(?:not|unproven|unverified|unconfirmed|unsupported|pending)\b|^\s*[:\-]\s*(?:no|none|not)\b/i;

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalizePackPath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "");
}

export function parsePackFilePaths(output) {
  const source = String(output ?? "");
  const candidates = [source.trim()];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "[" || source[index] === "{") {
      candidates.push(source.slice(index).trim());
    }
  }

  let payload;
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      const record = Array.isArray(parsed) ? parsed[0] : parsed;
      if (Array.isArray(record?.files)) {
        payload = parsed;
        break;
      }
    } catch {
      // npm may print a warning before its JSON payload; try the next offset.
    }
  }

  const record = Array.isArray(payload) ? payload[0] : payload;
  const files = record?.files;
  if (!Array.isArray(files)) {
    throw new Error("npm pack JSON did not contain a files array");
  }

  const paths = files
    .map((file) => (typeof file === "string" ? file : file?.path))
    .filter((path) => typeof path === "string")
    .map(normalizePackPath);
  if (paths.length === 0) {
    throw new Error("npm pack JSON contained no package files");
  }
  return [...new Set(paths)].sort();
}

export function inspectPackFiles(paths) {
  const normalized = [...new Set(paths.map(normalizePackPath))].sort();
  const leakedFiles = normalized.filter((path) =>
    FORBIDDEN_PACK_ROOTS.some((root) => path === root || path.startsWith(`${root}/`)),
  );
  const missingFiles = REQUIRED_PACK_FILES.filter((path) => !normalized.includes(path));
  return { files: normalized, leakedFiles, missingFiles };
}

function normalizeDocumentation(text) {
  let normalized = "";
  const originalOffsets = [];
  let whitespace = false;
  for (let index = 0; index < text.length; index += 1) {
    if (/\s/.test(text[index])) {
      if (!whitespace) {
        normalized += " ";
        originalOffsets.push(index);
        whitespace = true;
      }
      continue;
    }
    normalized += text[index];
    originalOffsets.push(index);
    whitespace = false;
  }
  return { normalized, originalOffsets };
}

function lineNumberAt(text, offset) {
  return text.slice(0, offset).split(/\r?\n/).length;
}

function isNegatedClaim(text, start, end) {
  const sentenceStart = Math.max(
    text.lastIndexOf(".", start - 1),
    text.lastIndexOf("!", start - 1),
    text.lastIndexOf("?", start - 1),
    text.lastIndexOf(";", start - 1),
    text.lastIndexOf(":", start - 1),
  );
  const before = text.slice(sentenceStart + 1, start);
  const butIndex = before.toLowerCase().lastIndexOf(" but ");
  const clauseBefore = before.slice(butIndex >= 0 ? butIndex + 5 : 0);
  const match = text.slice(start, end);
  const after = text.slice(end, end + 90);
  return NEGATION_PATTERN.test(clauseBefore) || NEGATION_PATTERN.test(match) || POST_NEGATION_PATTERN.test(after);
}

function allMatches(pattern, text) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return text.matchAll(new RegExp(pattern.source, flags));
}

export function findProhibitedDocumentationClaims(documents) {
  const findings = [];
  const seen = new Set();
  for (const document of documents) {
    const { normalized, originalOffsets } = normalizeDocumentation(document.text);
    for (const entry of PROHIBITED_DOCUMENTATION_PATTERNS) {
      for (const match of allMatches(entry.pattern, normalized)) {
        if (match.index === undefined) continue;
        const start = match.index;
        const end = start + match[0].length;
        if (isNegatedClaim(normalized, start, end)) continue;
        const originalOffset = originalOffsets[start] ?? 0;
        const line = lineNumberAt(document.text, originalOffset);
        const findingKey = `${document.path}|${entry.kind}|${line}`;
        if (seen.has(findingKey)) continue;
        seen.add(findingKey);
        findings.push({
          kind: entry.kind,
          path: document.path,
          line,
          match: match[0],
        });
      }
    }
  }
  return findings;
}

function collectMarkdownFiles(root) {
  const paths = ["README.md", "CHANGELOG.md", "docs/QUICKSTART.md", "docs/first-use.md", "docs/release-and-rollback.md"];
  const walk = (directory) => {
    if (!isFile(directory)) {
      let entries;
      try {
        entries = readdirSync(directory, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        const child = join(directory, entry.name);
        if (entry.isDirectory()) walk(child);
        else if (entry.isFile() && entry.name.endsWith(".md")) paths.push(relative(root, child));
      }
    }
  };
  walk(join(root, "examples"));
  return [...new Set(paths)].sort();
}

function readDocumentation(root) {
  return collectMarkdownFiles(root)
    .filter((path) => isFile(join(root, path)))
    .map((path) => ({ path, text: readFileSync(join(root, path), "utf8") }));
}

function runNpmPack(root) {
  return spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, npm_config_offline: "true" },
  });
}

function fail(check, message) {
  return { check, message };
}

export function checkReleaseCandidate({ root = REPOSITORY_ROOT, packRunner = runNpmPack } = {}) {
  const failures = [];
  const packagePath = join(root, "package.json");
  const lockPath = join(root, "package-lock.json");
  let packageJson;
  let packageLock;

  for (const path of REQUIRED_REPOSITORY_FILES) {
    if (!isFile(join(root, path))) failures.push(fail("required-files", `Missing file: ${path}`));
  }

  try {
    packageJson = readJson(packagePath);
  } catch (error) {
    failures.push(fail("package-metadata", `Cannot parse package.json: ${error.message}`));
  }
  try {
    packageLock = readJson(lockPath);
  } catch (error) {
    failures.push(fail("package-metadata", `Cannot parse package-lock.json: ${error.message}`));
  }

  if (packageJson) {
    if (packageJson.private !== false) failures.push(fail("package-metadata", "package.json must set private to false"));
    if (typeof packageJson.version !== "string" || !ALPHA_VERSION.test(packageJson.version)) {
      failures.push(fail("package-metadata", `Version must be a valid alpha prerelease: ${String(packageJson.version)}`));
    }
    if (packageJson.version && packageLock?.packages?.[""].version !== packageJson.version) {
      failures.push(fail("package-metadata", "package.json and package-lock.json versions must match"));
    }
  }

  const claims = findProhibitedDocumentationClaims(readDocumentation(root));
  for (const claim of claims) {
    failures.push(fail("documentation-claims", `${claim.path}:${claim.line} ${claim.kind}: ${claim.match}`));
  }

  let pack;
  try {
    pack = packRunner(root);
  } catch (error) {
    failures.push(fail("npm-pack", `Could not run npm pack: ${error.message}`));
  }
  if (pack && pack.status !== 0) {
    failures.push(fail("npm-pack", pack.stderr || pack.stdout || `npm pack exited with ${String(pack.status)}`));
  }

  let packInspection;
  if (pack && pack.status === 0) {
    try {
      packInspection = inspectPackFiles(parsePackFilePaths(pack.stdout));
      if (packInspection.leakedFiles.length > 0) {
        failures.push(fail("npm-pack", `Forbidden package paths: ${packInspection.leakedFiles.join(", ")}`));
      }
      if (packInspection.missingFiles.length > 0) {
        failures.push(fail("package-surfaces", `Missing packed files: ${packInspection.missingFiles.join(", ")}`));
      }
    } catch (error) {
      failures.push(fail("npm-pack", error.message));
    }
  }

  return {
    status: failures.length === 0 ? "pass" : "fail",
    package: packageJson
      ? { name: packageJson.name, version: packageJson.version, private: packageJson.private }
      : null,
    packFileCount: packInspection?.files.length ?? 0,
    failures,
  };
}

function main() {
  const report = checkReleaseCandidate();
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (report.status === "pass") process.stdout.write(output);
  else process.stderr.write(output);
  process.exitCode = report.status === "pass" ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
