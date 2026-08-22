# OpenSheet-AI

OpenSheet-AI is a provider-neutral plan-and-execution protocol for agent-driven spreadsheet automation. It converts typed business intents into deterministic spreadsheet operations, checks those operations against an explicit policy, supports dry-run previews, and emits machine-readable receipts.

The project is deliberately not another spreadsheet chatbot or a direct-write MCP server. Model providers, MCP servers, Excel, Google Sheets, ERP connectors, and quantitative engines belong at the edges. The core remains deterministic and testable without credentials, network access, or an LLM.

**Status:** foundation prototype (`0.0.0-dev`). The package is private and unpublished. The name was available on npm when checked on 22 August 2026, but that check is not a reservation or trademark clearance.

## Current vertical slice

- versioned `opensheet.plan.v1` operation contract;
- typed separation between values and formulas;
- strict A1-range parsing and plan validation;
- default-deny formula policy with operation and cell budgets;
- deterministic canonical JSON and SHA-256 plan digests;
- immutable in-memory adapter with dry-run and execution receipts;
- first modules: research scale bank and coverage gap map;
- CLI for compile, validate, and in-memory preview/apply.

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

Add `--apply` to `apply-memory` to return the resulting in-memory workbook rather than a dry-run receipt.

## Library example

```ts
import {
  compileScaleBank,
  createEmptyWorkbook,
  executeInMemory,
} from "opensheet-ai";

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

const result = executeInMemory(compiled.plan, createEmptyWorkbook(), {
  dryRun: true,
  now: () => "2026-08-22T00:00:00.000Z",
});

console.log(result.receipt);
```

## Product boundary

OpenSheet-AI plans and governs mutations. It does not currently parse natural language, call model APIs, edit `.xlsx` files, connect to Google Sheets, calculate formulas, run SEM, or synchronize ERP/payment systems. Those are planned adapters or plugins after the core contract is stable.

See [the product specification](docs/PRODUCT_SPEC.md), [architecture](docs/ARCHITECTURE.md), [implementation plan](docs/IMPLEMENTATION_PLAN.md), [threat model](docs/THREAT_MODEL.md), and [landscape research](docs/research/2026-08-22-landscape.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
