# First use: turn one typed change into a workbook artifact

The first useful result is a reproducible local run that turns a typed intent
into a validated plan, a dry-run receipt, and a new `.xlsx` file. No model API,
spreadsheet account, or existing workbook is required for this path.

## Five-minute local path

```bash
npm ci
npm run build
node dist/cli.js compile examples/scale-bank.json > /tmp/opensheet-plan.json
node dist/cli.js validate /tmp/opensheet-plan.json
node dist/cli.js apply-memory /tmp/opensheet-plan.json
node dist/cli.js apply-xlsx /tmp/opensheet-plan.json \
  --out /tmp/opensheet-first-use.xlsx --apply
```

The expected checkpoints are:

- the plan validates as `opensheet.plan.v1` and prints a digest;
- the in-memory path returns a `dry-run` receipt;
- the `.xlsx` adapter creates a new file whose literal cells match the plan.

The adapter is greenfield-only. It does not connect to Google Sheets or Excel
Desktop, recalculate formulas, parse natural language, or estimate research
models.

## What to report

Record the package/tag, Node version, time to the first artifact, first error,
and whether the generated workbook was useful for a real task. Use the
[first-use feedback form](https://github.com/daichunghy/opensheet-ai/issues/new?template=first-use.md)
without attaching private workbook data or credentials.

This path proves a local adapter workflow. It does not prove external users,
production spreadsheet integrations, or statistical validity.
