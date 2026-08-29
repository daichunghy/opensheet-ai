import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ERROR_CODES_PATTERN = /export const ERROR_CODES = \{([\s\S]*?)\n\} as const;/;
const DECLARED_CODE_PATTERN = /^\s+[A-Za-z_][A-Za-z0-9_]*:\s*["']([^"']+)["'],?\s*$/gm;
const STRUCTURED_CODE_PATTERN = /\bcode\s*:\s*["']([^"']+)["']/g;
const FINDING_CODE_PATTERN = /\bfinding\(\s*["']([^"']+)["']/g;
const DOC_ROW_PATTERN = /^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/gm;

function collectMatches(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

export async function collectStructuredErrorCodes(root) {
  const errorsSource = await readFile(join(root, "src/core/errors.ts"), "utf8");
  const declaredBlock = errorsSource.match(ERROR_CODES_PATTERN)?.[1];
  if (declaredBlock === undefined) {
    throw new Error("Could not find ERROR_CODES in src/core/errors.ts");
  }

  const codes = collectMatches(declaredBlock, DECLARED_CODE_PATTERN);
  if (codes.length === 0) {
    throw new Error("ERROR_CODES in src/core/errors.ts is empty or has an unsupported shape");
  }

  const coreFiles = (await readdir(join(root, "src/core")))
    .filter((file) => file.endsWith(".ts"))
    .sort();
  for (const file of coreFiles) {
    const source = await readFile(join(root, "src/core", file), "utf8");
    codes.push(...collectMatches(source, STRUCTURED_CODE_PATTERN));
    codes.push(...collectMatches(source, FINDING_CODE_PATTERN));
  }

  return [...new Set(codes)].sort();
}

export async function readDocumentedErrorCodes(root) {
  const document = await readFile(join(root, "docs/ERRORS.md"), "utf8");
  const rows = [...document.matchAll(DOC_ROW_PATTERN)].map((match) => ({
    code: match[1],
    source: match[2].trim(),
    cause: match[3].trim(),
    fix: match[4].trim(),
  }));
  return { document, rows };
}

export async function validateErrorReference(root) {
  const errors = [];
  const sourceCodes = await collectStructuredErrorCodes(root);
  const { document, rows } = await readDocumentedErrorCodes(root);

  if (!document.includes("# Structured error-code reference")) {
    errors.push("docs/ERRORS.md is missing its expected title");
  }
  if (rows.length === 0) {
    errors.push("docs/ERRORS.md has no structured error-code table rows");
  }

  const documentedCodes = rows.map((row) => row.code);
  const duplicates = documentedCodes.filter(
    (code, index) => documentedCodes.indexOf(code) !== index,
  );
  for (const code of [...new Set(duplicates)]) {
    errors.push(`docs/ERRORS.md documents ${code} more than once`);
  }

  for (const row of rows) {
    if (!row.source || !row.cause || !row.fix) {
      errors.push(`${row.code} must include source, cause, and smallest fix`);
    }
  }

  const sourceSet = new Set(sourceCodes);
  const documentedSet = new Set(documentedCodes);
  for (const code of sourceCodes.filter((value) => !documentedSet.has(value))) {
    errors.push(`${code} exists in src/core but is missing from docs/ERRORS.md`);
  }
  for (const code of documentedCodes.filter((value) => !sourceSet.has(value))) {
    errors.push(`${code} is documented but not found as a structured source code in src/core`);
  }

  return {
    ok: errors.length === 0,
    errors,
    sourceCodes,
    documentedCodes,
    rows,
  };
}
