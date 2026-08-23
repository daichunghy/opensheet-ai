#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { validateErrorReference } from "./error-reference.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const result = await validateErrorReference(root);

if (!result.ok) {
  process.stderr.write(`error reference: failed\n${result.errors.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`error reference: pass (${result.sourceCodes.length} codes)\n`);
