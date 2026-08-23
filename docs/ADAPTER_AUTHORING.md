# Adapter authoring

Implement the public `SheetAdapter` contract from `src/core/adapter.ts`. Consumers should call an adapter's `preview` or `apply` method; do not call a memory implementation helper directly. Do not call network, models, or the wall clock inside plan compilation.

## Required behavior

1. Validate with `compilePlan` / `assertSheetPlan` before mutation.
2. `evaluatePolicy`, then `preflightPlan` against a capability manifest.
3. Fail closed on unsupported kinds and plan versions.
4. Dry-run must not write caller state or files.
5. Apply writes only after preconditions pass.
6. Return `opensheet.receipt.v1`. Do not put workbook cell values in the receipt.
7. Compare adapters with `explodeSnapshot` / `digestSnapshot`, not file bytes.

## Capability

Declare every `opensheet.plan.v1` kind as `supported` or `unsupported`. The memory adapter is the in-process reference. The `.xlsx` adapter is a greenfield file writer.

## Conformance

Recorded plans live in `test/fixtures/conformance/`. Run:

```bash
npm run check:conformance
```

Minimum classes: ensure/write, literal `=`, default-deny formulas, dry-run non-mutation, blocked unsupported kind.

A toy adapter that only logs operations is not a passing adapter unless it still returns receipts and refuses to claim Excel support.

For the reference adapter, the public consumer shape is:

```ts
import { createEmptyWorkbook, memoryAdapter } from "opensheet-ai/memory";

const result = memoryAdapter.preview(plan, createEmptyWorkbook(plan.target.workbook));
console.log(result.snapshot, result.receipt);
```
