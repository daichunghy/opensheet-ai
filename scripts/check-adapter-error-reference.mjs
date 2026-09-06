#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { validateAdapterErrorReference } from "./adapter-error-reference.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const result = await validateAdapterErrorReference(root);

if (!result.ok) {
  process.stderr.write(`adapter error reference: failed\n${result.errors.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `adapter error reference: pass (${result.adapterCodes.length} xlsx-local codes; ${result.xlsxLiteralCodes.length} literal codes, ${result.coreCodes.length} core codes)\n`,
);
