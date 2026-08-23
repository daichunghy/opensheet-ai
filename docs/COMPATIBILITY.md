# OpenSheet-AI compatibility

**Status:** local foundation prototype
**Package version:** `0.0.0-dev`
**Public semver:** not started. There is no compatibility guarantee for external consumers until a public prerelease is explicitly authorized.

## Plan v1

`opensheet.plan.v1` is a closed discriminated union. Readers and adapters must fail closed on:

- unknown `schemaVersion`;
- unknown operation `kind`;
- unknown properties on the plan envelope or an operation.

The TypeScript validator (`assertSheetPlan`) is the runtime source of truth. Published JSON Schema is a portable approximation. Residual gaps are listed in [ADR 0002](decisions/0002-schema-validator-test-only.md).

## Adapter behavior

Unsupported operation kinds are not skipped, coerced, or partially applied. `preflightPlan` returns `unsupported_operation` or `unsupported_plan_version` and the in-memory adapter emits a `blocked` receipt without mutating caller-owned state.

The in-memory adapter also fails closed with a receipt for:

- `workbook_identity_mismatch` when `plan.target.workbook` does not equal the adapter workbook id;
- `missing_sheet` when an operation targets a sheet that does not exist and is not created earlier in the plan.

## Receipts and state digests

`opensheet.receipt.v1` binds `planDigest` to canonical JSON of the plan. The in-memory adapter’s `beforeDigest` / `afterDigest` are `digestJson(workbook)` over the adapter workbook object, not the normalized `opensheet.snapshot.v1` digest. Snapshot digests are a separate, sorted semantic view.

## Versioning policy after publication

After the first public prerelease:

- breaking plan changes require a new schema version or a major package release;
- new operation kinds require a new plan schema version;
- additive optional fields still need an explicit compatibility decision.

Until then, treat every export as unstable.

## Package identity

Schema `$id` values use `https://opensheet-ai.dev/schemas/...` as **identifiers**, not proof that the domain is hosted. Execution helpers are exported from `opensheet-ai/memory` and `opensheet-ai/xlsx`, not `"."`. The `.xlsx` adapter writes a new file; it does not claim round-trip of arbitrary workbooks, Google Sheets, or recalculation.

Canonical JSON is specified in [CANONICAL_JSON.md](CANONICAL_JSON.md). It is not RFC 8785.
