# OpenSheet-AI Agent Verification Map

**Status:** local operating contract
**Authority:** `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`,
`docs/THREAT_MODEL.md`, exported contracts, schemas and tests

OpenSheet-AI applies the transcript's verification-first workflow to a
deterministic spreadsheet plan. The core is a typed plan boundary, not a model
runtime. Natural language, credentials, network calls and platform execution
remain outside the core.

## Trust curve

```text
validate typed intent
  -> compile deterministic plan
  -> evaluate policy and capability
  -> preview without mutation
  -> apply only through an explicit adapter
  -> read back and verify receipt
  -> bounded agent work and external integration evidence
```

A model or agent may propose intent, but only a validated plan may reach an
adapter. A receipt describes the represented workbook state; it is not proof
of business correctness, authorization or production integration.

## Surface map

| Surface | Start here | Minimum verification | Invariant |
| --- | --- | --- | --- |
| Core contracts | `src/core/`, `schemas/` | schema, type and reconciliation tests | unknown versions fail closed |
| Modules | `src/modules/`, `examples/` | module, negative and determinism tests | compilers are pure and typed |
| Policy/preflight | `src/core/policy.ts`, capability and preconditions | policy, boundary and idempotency tests | validate, govern, then execute |
| Memory adapter | `src/adapters/memory.ts` | dry-run, clone and receipt tests | caller-owned state is never mutated |
| XLSX adapter | `src/adapters/xlsx.ts` | XLSX conformance, read-back and clean-room checks | writes new files; unsupported input fails closed |
| CLI | `src/cli.ts` | CLI smoke and quickstart sessions | stdout JSON and actionable errors |
| Package surface | `package.json`, `scripts/check-pack.mjs` | package, secret and budget checks | declared files match shipped surface |
| Future adapters | Google Sheets, MCP, statistics, connectors | explicit capability and live evidence | do not claim unsupported adapters |

## Verification ladder

```bash
npm run typecheck
npm run test
npm run build
npm run check:schema
npm run check:errors
npm run check:conformance
npm run check:smoke
npm run check:quickstart
npm run check:agent-contract
npm run verify
npm run agent-eval -- OS-01
```

`apply-memory` and `apply-xlsx` must remain dry-run unless `--apply` is
explicitly supplied. Existing workbook writes, Google Sheets writes and any
credentialed runtime require a separate adapter contract and evidence.

## Non-negotiable PR invariants

- core compilers use no network, credentials, model calls, filesystem reads,
  randomness or implicit wall-clock time;
- typed values and formulas remain different operation kinds;
- validation completes before policy, capability and precondition checks;
- dry-run and blocked paths leave caller-owned state unchanged;
- adapters fail closed before mutation when an operation is unsupported;
- recodes and audits do not drop rows or overwrite source columns;
- `cited` provenance requires a citation, while demonstration items stay marked;
- receipts bind exact plan and state digests but do not claim authorization;
- no SEM/statistical engine, Excel desktop, Google Sheets, payment or ERP claim
  is added without separate evidence;
- one agent task has one purpose, explicit paths and a reversible diff;
- local tests are not external-user, production or release evidence.

## Bounded work

Use two or three independent tasks only when their write sets are disjoint.
Serialize core contract, adapter capability, XLSX output and package-surface
changes. The parent maintainer inspects every diff, runs targeted checks, then
runs `npm run verify`. Timeouts and agent summaries are not completion evidence.

## Failure-to-guardrail loop

Turn every recurring failure into a deterministic fixture, property test,
stable error reference, package check or adapter conformance case. Add the
smallest reliable guardrail and document the unsupported behavior rather than
silently broadening the contract.

## Handoff

```text
Scope:
Files changed:
Invariant protected:
Targeted checks:
Aggregate check:
Evidence level:
Known unsupported behavior:
```
