# Quick start

For the shortest user-facing path, start with [First use](first-use.md).

Public alpha package `opensheet-ai@0.1.0-alpha.5`. Node 20 or 22.

```bash
npm install
npm run verify
npm run build

node dist/cli.js compile examples/scale-bank.json > /tmp/plan.json
node dist/cli.js validate /tmp/plan.json
node dist/cli.js apply-memory /tmp/plan.json
node dist/cli.js apply-xlsx /tmp/plan.json --out /tmp/opensheet.xlsx --apply
```

`apply-memory` and `apply-xlsx` are dry-run unless `--apply`. Receipts go to stdout. `.xlsx` writes a **new** file; overwrite needs `--overwrite`. Reading an existing workbook needs `--allow-sheet`.

Library:

```ts
import { compileScaleBank } from "opensheet-ai";
import { createEmptyWorkbook, memoryAdapter } from "opensheet-ai/memory";
import { executeXlsx } from "opensheet-ai/xlsx";
```

For a published consumer, import from `opensheet-ai` and `opensheet-ai/memory`; use `dist/` only when working from this repository.

A session is successful when: compile emits `opensheet.plan.v1`, validate prints a `sha256:` digest, dry-run receipt status is `dry-run`, and `--apply` for xlsx creates a file whose cells match the plan literals.
