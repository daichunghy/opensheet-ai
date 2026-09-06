# Service-quality scale-bank demonstration

This example turns a typed `scale-bank.v1` intent into a readable,
multi-factor reference sheet for service quality and customer satisfaction.
It contains four illustrative constructs, twelve items, and one reverse-keyed
item (`SAT3`). The `Reverse` column records metadata for a later scoring step;
this example does not calculate scores or recode responses.

Every item is explicitly labelled as a demonstration item. It is not a
validated measurement instrument, a research result, or a recommendation to
use these items without replacing them with an appropriate cited scale and
reviewing the study design.

## Run it

Build the local package first, then print the deterministic, human-readable
artifact:

```bash
npm run build
node examples/service-quality/preview.mjs > /tmp/service-quality-preview.json
```

The checked-in [preview artifact](preview.json) exposes `constructs`,
`reverseKeyedItems`, `table`, the plan digest, a dry-run receipt, and the
in-memory snapshot. It is generated with a fixed clock so the output can be
replayed and compared.

You can also open the ready-to-view [sample workbook](sample.xlsx) directly.
Start on `Read me`, then use `Scale Bank` to review the four constructs and the
reverse-keyed `SAT3` metadata.

The normal CLI path can also compile, validate, preview, and create a new
local XLSX file:

```bash
node dist/cli.js compile examples/service-quality/intent.json > /tmp/service-quality-plan.json
node dist/cli.js validate /tmp/service-quality-plan.json
node dist/cli.js apply-memory /tmp/service-quality-plan.json
node dist/cli.js apply-xlsx /tmp/service-quality-plan.json \
  --out /tmp/service-quality.xlsx --apply
```

This is local plan/memory/XLSX artifact evidence only. It uses no network,
model, or credentials; it does not connect to native Excel Desktop or Google
Sheets, recalculate formulas, score responses, or provide statistical
inference. The sample workbook content is illustrative and does not establish
native-platform, production, or external-user evidence.
