# ADR 0002: Keep Ajv as a test/CI validator only

**Status:** accepted
**Date:** 22 August 2026

## Context

NFR-002 requires the published core to prefer standard-library primitives. Plan validation already has a deterministic TypeScript implementation (`assertSheetPlan` / `compilePlan`). A JSON Schema engine would add size, license, and supply-chain surface to every runtime import.

F1 still needs evidence that the published JSON Schema and the TypeScript validator do not silently drift.

## Decision

Ajv 2020-12 and `ajv-formats` are **devDependencies**. They may be imported from `test/` and `scripts/check-schema.mjs` only.

The execution path remains `assertSheetPlan` → `evaluatePolicy` → adapter preflight. The CLI `validate` command continues to call `compilePlan`. Adding Ajv to the published runtime requires a future ADR covering bundle size, license, and security.

## Residual gaps

JSON Schema cannot express every runtime rule. The TypeScript validator remains authoritative for these cases:

| Rule | TypeScript | JSON Schema / Ajv |
| --- | --- | --- |
| Excel row/column bounds (`XFE1`, `A1048577`) | reject | pattern may accept |
| Reversed A1 ranges (`B2:A1`) | reject | pattern may accept |
| Finite numbers only (`Infinity`, `NaN`) | reject | JSON text cannot encode them; Ajv also rejects JS `Infinity` |
| Matrix vs range dimension match | reject | not expressed |
| Rectangular / non-jagged matrices | reject | not expressed |
| Duplicate operation ids when operations otherwise differ | reject | `uniqueItems` compares whole items |
| Lowercase A1 ranges (`a1:b2`) | accept and normalize | uppercase-only pattern rejects |

Fixtures used by `test/schema-reconciliation.test.ts` are uppercase and otherwise inside the overlapping valid set. Residual cases must still fail `assertSheetPlan`.

## Consequences

Positive consequences:

- published `dist/` stays free of Ajv;
- schema/runtime drift is tested in CI;
- residual gaps are explicit instead of implied completeness.

Costs:

- hosts that want schema validation must depend on Ajv themselves, or wait for a future optional package.
