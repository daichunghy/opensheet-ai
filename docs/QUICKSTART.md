# Quick start

For the shortest user-facing path, start with [First use](first-use.md).

For a more concrete operations table, see the [inventory and revenue
example](../examples/inventory-revenue/guide.md).

For a multi-factor reference-sheet example, see the [service-quality
example](../examples/service-quality/guide.md).

Both guides link to a ready-to-open `.xlsx` sample, so you can inspect the
result before changing an intent or writing a new workbook.

Public alpha package `opensheet-ai@0.1.0-alpha.5`. Node 20 or 22.

After the prepared alpha.5 package is published, the package-first path is:

```bash
npm install --save-exact opensheet-ai@0.1.0-alpha.5
npx opensheet-ai preview node_modules/opensheet-ai/examples/inventory-revenue/intent.json --format text
```

```bash
npm install
npm run verify
npm run build

node dist/cli.js compile examples/scale-bank.json > /tmp/plan.json
node dist/cli.js validate /tmp/plan.json
node dist/cli.js apply-memory /tmp/plan.json
node dist/cli.js apply-xlsx /tmp/plan.json --out /tmp/opensheet.xlsx --apply

# Or preview a typed intent directly without creating an intermediate plan file.
node dist/cli.js preview examples/inventory-revenue/intent.json

# Or request a concise human-readable preview (JSON remains the default).
node dist/cli.js preview examples/inventory-revenue/intent.json --format text
```

`apply-memory` and `apply-xlsx` are dry-run unless `--apply`. Receipts go to stdout. `.xlsx` writes a **new** file; overwrite needs `--overwrite`. Reading an existing workbook needs `--allow-sheet`.

`preview` accepts a typed intent directly and prints the compiled plan, plan
digest, summary, and memory `dry-run` receipt as one JSON object. It does not
write a file by default. Use `--in <workbook.json>` to preview against a
memory workbook and `--print-workbook` to include the unchanged in-memory
state in the JSON output. Use `--format text` for a concise summary of the
intent/source, plan, receipt status, and next step; JSON remains the default.
Typed-intent validation still applies in either format. A blocked preview
returns a non-zero status and reports findings without changing the workbook.

Library:

```ts
import { compileScaleBank } from "opensheet-ai";
import { createEmptyWorkbook, memoryAdapter } from "opensheet-ai/memory";
import { executeXlsx } from "opensheet-ai/xlsx";
```

For a published consumer, import from `opensheet-ai` and `opensheet-ai/memory`; use `dist/` only when working from this repository.

A session is successful when: compile emits `opensheet.plan.v1`, validate prints a `sha256:` digest, dry-run receipt status is `dry-run`, and `--apply` for xlsx creates a file whose cells match the plan literals.
