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

export async function collectCoreErrorCodes(root) {
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

export async function collectXlsxLiteralCodes(root) {
  const source = await readFile(join(root, "src/adapters/xlsx.ts"), "utf8");
  return [...new Set(collectMatches(source, STRUCTURED_CODE_PATTERN))].sort();
}

export async function readDocumentedAdapterErrorCodes(root) {
  const document = await readFile(join(root, "docs/ERRORS-ADAPTERS.md"), "utf8");
  const rows = [...document.matchAll(DOC_ROW_PATTERN)].map((match) => ({
    code: match[1],
    source: match[2].trim(),
    cause: match[3].trim(),
    fix: match[4].trim(),
  }));
  return { document, rows };
}

export async function validateAdapterErrorReference(root) {
  const errors = [];
  const coreCodes = await collectCoreErrorCodes(root);
  const xlsxLiteralCodes = await collectXlsxLiteralCodes(root);
  const adapterCodes = xlsxLiteralCodes.filter((code) => !coreCodes.includes(code));
  const { document, rows } = await readDocumentedAdapterErrorCodes(root);

  if (!document.includes("# Adapter-specific xlsx error-code reference")) {
    errors.push("docs/ERRORS-ADAPTERS.md is missing its expected title");
  }
  if (!/not part of core\s+`?ERROR_CODES`?/i.test(document)) {
    errors.push("docs/ERRORS-ADAPTERS.md must state that adapter codes are not core ERROR_CODES");
  }
  if (rows.length === 0) {
    errors.push("docs/ERRORS-ADAPTERS.md has no adapter error-code table rows");
  }

  const documentedCodes = rows.map((row) => row.code);
  const duplicates = documentedCodes.filter(
    (code, index) => documentedCodes.indexOf(code) !== index,
  );
  for (const code of [...new Set(duplicates)]) {
    errors.push(`docs/ERRORS-ADAPTERS.md documents ${code} more than once`);
  }

  for (const row of rows) {
    if (!row.source || !row.cause || !row.fix) {
      errors.push(`${row.code} must include source, cause, and smallest fix`);
    }
  }

  const adapterSet = new Set(adapterCodes);
  const documentedSet = new Set(documentedCodes);
  const coreSet = new Set(coreCodes);
  for (const code of adapterCodes.filter((value) => !documentedSet.has(value))) {
    errors.push(`${code} exists in src/adapters/xlsx.ts but is missing from docs/ERRORS-ADAPTERS.md`);
  }
  for (const code of documentedCodes.filter((value) => !adapterSet.has(value))) {
    if (coreSet.has(code)) {
      errors.push(`${code} is a core code and must remain documented in docs/ERRORS.md`);
    } else {
      errors.push(`${code} is documented but is not a literal xlsx adapter code`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    coreCodes,
    xlsxLiteralCodes,
    adapterCodes,
    documentedCodes,
    rows,
  };
}
