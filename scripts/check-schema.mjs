#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const files = [
  "plan.v1.schema.json",
  "receipt.v1.schema.json",
  "capability.v1.schema.json",
  "snapshot.v1.schema.json",
  "intent.scale-bank.v1.schema.json",
  "intent.gap-map.v1.schema.json",
  "intent.kpi-threshold.v1.schema.json",
];

for (const file of files) {
  const schema = JSON.parse(await readFile(join(root, "schemas", file), "utf8"));
  ajv.compile(schema);
  process.stdout.write(`ok ${file}\n`);
}
