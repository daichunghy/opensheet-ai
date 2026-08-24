# OpenSheet-AI

OpenSheet-AI is a provider-neutral plan-and-execution protocol for agent-driven spreadsheet automation. It converts typed business intents into deterministic spreadsheet operations, checks those operations against an explicit policy, supports dry-run previews, and emits machine-readable receipts.

The project is deliberately not another spreadsheet chatbot or a direct-write MCP server. Model providers, MCP servers, Excel, Google Sheets, ERP connectors, and quantitative engines belong at the edges. The core remains deterministic and testable without credentials, network access, or an LLM.

**Status:** public alpha (`0.1.0-alpha.5`). The release is deliberately narrow: deterministic planning, policy evaluation, receipts, in-memory execution, and a greenfield `.xlsx` adapter. It does not claim Google Sheets, Excel desktop, formula recalculation, SEM, ERP, payment, or production adoption.

> If a dry-run receipt caught a wrong range before it reached a workbook,
> [star it](https://github.com/daichunghy/opensheet-ai/stargazers). That is the
> only growth signal this repo tracks.

## Install from npm

Install the public alpha from the npm registry:

```bash
npm install opensheet-ai@alpha
```

The GitHub source is `0.1.0-alpha.5`; the npm `alpha` dist-tag currently resolves `0.1.0-alpha.4`
until the alpha.5 publication completes. Check the registry metadata before recording a consumer
install as evidence.

## Verify from source

```bash
git clone --branch v0.1.0-alpha.5 https://github.com/daichunghy/opensheet-ai.git
cd opensheet-ai
npm ci
npm run verify
```

The package targets Node.js 20 and 22. The GitHub repository is the source of truth for the release, compatibility notes, and issue reporting.

Support and first-run questions: [`.github/SUPPORT.md`](.github/SUPPORT.md) or [GitHub Discussions](https://github.com/daichunghy/opensheet-ai/discussions).
For a consented human walkthrough, use the [35-minute session invite](docs/sessions/INVITE-EN.md)
and [session protocol](docs/sessions/PROTOCOL.md).

## Current vertical slice

- versioned `opensheet.plan.v1` operation contract;
- typed separation between values and formulas;
- strict A1-range parsing, structured error codes, and plan validation;
- default-deny formula policy with operation and cell budgets;
- adapter capability preflight, workbook snapshots, preconditions, and opt-in idempotent replay;
- deterministic canonical JSON and SHA-256 plan and receipt verification;
- immutable in-memory adapter with dry-run and execution receipts;
- first modules: research scale bank and coverage gap map;
- CLI for compile, validate, in-memory preview/apply, greenfield `.xlsx` apply, and receipt verification;
- research modules (scale bank, gap map) plus a KPI threshold table.

F1 hardens the contract. F2 adds a **greenfield `.xlsx` writer** (`opensheet-ai/xlsx`, ExcelJS). It writes a new file, fails closed on unsupported input features, reports missing or unreadable input as `xlsx_input_read_failed` ([diagnostic reference](docs/XLSX_INPUT_DIAGNOSTICS.md)), and does not claim Google Sheets, Excel desktop, or formula recalculation. The package targets Node.js 20 and 22 (`engines.node` is `>=20 <23`). Execution helpers live on `opensheet-ai/memory` and `opensheet-ai/xlsx`, not the root export.

## Quick start

```bash
npm install
npm run verify
npm run build

node dist/cli.js compile examples/scale-bank.json
node dist/cli.js compile examples/gap-map.json
```

Validate or preview a compiled plan:

```bash
node dist/cli.js compile examples/scale-bank.json > /tmp/opensheet-plan.json
node dist/cli.js validate /tmp/opensheet-plan.json
node dist/cli.js apply-memory /tmp/opensheet-plan.json
```

`apply-memory` prints the receipt. Add `--apply` to execute a cloned workbook instead of dry-run, and `--print-workbook` to include the workbook object.

## Library example

```ts
import { compileScaleBank } from "opensheet-ai";
import { createEmptyWorkbook, executeInMemory } from "opensheet-ai/memory";

const compiled = compileScaleBank({
  module: "scale-bank",
  version: 1,
  workbook: "research-demo",
  constructs: [
    {
      code: "TRUST",
      name: "Trust",
      scale: { min: 1, max: 5 },
      items: [{ code: "TRUST1", text: "I trust this service." }],
    },
  ],
});

const result = executeInMemory(compiled.plan, createEmptyWorkbook("research-demo"), {
  dryRun: true,
  now: () => "2026-08-22T00:00:00.000Z",
});

console.log(result.receipt);
```

## Product boundary

OpenSheet-AI plans and governs mutations. The `.xlsx` adapter writes a new workbook from a validated plan and reads it back. It does not parse natural language, call model APIs, connect to Google Sheets, recalculate formulas, run SEM, or synchronize ERP/payment systems.

This alpha proves local/package behavior through `npm run verify`, including schema reconciliation, clean-room installation, CLI smoke tests, conformance fixtures, and local quickstart sessions. Those checks are not evidence of external users or production integrations.

See [quick start](docs/QUICKSTART.md), [the product specification](docs/PRODUCT_SPEC.md), [architecture](docs/ARCHITECTURE.md), [implementation plan](docs/IMPLEMENTATION_PLAN.md), [compatibility](docs/COMPATIBILITY.md), [threat model](docs/THREAT_MODEL.md), and [landscape research](docs/research/2026-08-22-landscape.md).

## Who this is for

- Operators who rebuild the same spreadsheet deliverables by hand and want a
  reviewable, versioned plan with a dry-run receipt instead of one-shot
  generation.
- Agent builders who need a deterministic spreadsheet layer behind a model
  frontend.
- Not a fit if you need Google Sheets, Excel desktop writes, or formula
  recalculation in this alpha.

If a dry-run receipt caught a wrong range for you, star the repository. It
helps other operators find the protocol.

Release history: [CHANGELOG.md](CHANGELOG.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
