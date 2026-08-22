# OpenSheet-AI Architecture

**Status:** foundation architecture
**Date:** 22 August 2026

## 1. Architectural objective

OpenSheet-AI separates probabilistic interpretation from deterministic spreadsheet mutation. The stable boundary is a validated, provider-neutral plan that can be inspected, governed, tested, and mapped to more than one spreadsheet runtime.

```text
Application, human, agent, or MCP server
                   |
                   v
          typed intent producer
                   |
                   v
       deterministic module compiler
                   |
                   v
        opensheet.plan.v1 + digest
                   |
        validation -> policy decision
                   |
       +-----------+------------+
       |                        |
    blocked                  permitted
    receipt                      |
                         adapter capability check
                                  |
                         dry-run or apply
                                  |
                         execution receipt
```

## 2. Source-of-truth hierarchy

For current behavior, use this order:

1. exported TypeScript contract and runtime validator;
2. public JSON Schema;
3. conformance and negative tests;
4. adapter implementation and observed runtime result;
5. examples and README;
6. roadmap statements.

The runtime contract and JSON Schema must be reconciled before a public prerelease. The current prototype tests their identities but does not yet run a shared JSON Schema validator.

## 3. Core invariants

### 3.1 Deterministic compilers

A compiler is a pure function from a typed intent to a `SheetPlan`. It may validate and normalize its own domain input. It may not call a model, read a workbook, inspect the environment, generate randomness, or use implicit time.

### 3.2 Closed operation vocabulary

`opensheet.plan.v1` is a discriminated union. An adapter receives data, not executable JavaScript, Python, Apps Script, shell commands, or macros.

### 3.3 Typed formula separation

Literal strings and formulas use different operations. A string beginning with `=` in `write-range` remains a literal. Only `write-formulas` expresses formula intent, and the default policy blocks it.

### 3.4 Validate, then govern, then execute

Adapters must not mutate state before all three checks complete:

1. structural validation;
2. policy decision;
3. adapter capability and precondition checks.

### 3.5 Immutable caller state

Dry-run never mutates. The in-memory adapter also returns a clone when it applies a plan. Concrete adapters may modify external workbooks only after passing their own preconditions and shall return state evidence.

### 3.6 Evidence boundaries

A receipt binds the plan and the adapter-represented workbook state. It does not by itself prove:

- the business intent was correct;
- a human approved the change;
- a cloud API committed it;
- formulas recalculated correctly;
- an external system received synchronized data;
- the package is safe for production.

## 4. Version 1 plan model

### 4.1 Envelope

```json
{
  "schemaVersion": "opensheet.plan.v1",
  "planId": "scale-bank-...",
  "source": { "module": "scale-bank", "version": "1" },
  "target": { "workbook": "research-demo" },
  "operations": [],
  "metadata": {}
}
```

`planId` supports human correlation. The SHA-256 digest is the integrity identifier and is calculated from canonical JSON over the complete envelope.

### 4.2 Operation semantics

| Operation | Meaning | Foundation policy |
| --- | --- | --- |
| `ensure-sheet` | Create a named sheet if absent, or reuse it | allowed |
| `write-range` | Write an exact rectangular literal matrix | allowed within budgets |
| `write-formulas` | Write an exact rectangular formula matrix | blocked by default |
| `set-data-validation` | Attach a supported list or number range rule | allowed |
| `set-format` | Apply the explicit v1 format subset | allowed |
| `freeze-pane` | Set frozen row and column counts | allowed |
| `set-column-widths` | Set explicit widths for named columns | allowed |

No operation in version 1 deletes sheets, rows, columns, cells, tables, charts, or files.

### 4.3 Range contract

The core accepts single cells or top-left-to-bottom-right A1 ranges without sheet prefixes, absolute markers, unions, named ranges, or entire-row/column syntax. It normalizes to an explicit range such as `A1:A1`.

This restricted grammar makes cell budgets, matrix dimensions, and adapter mapping predictable. Later syntax requires a schema-version decision.

## 5. Policy model

The initial policy is intentionally small and deterministic. It contains no code callbacks.

```ts
interface SheetPolicy {
  maxOperations: number;
  maxTouchedCells: number;
  allowSheetCreation: boolean;
  allowFormulaWrites: boolean;
  allowFormatting: boolean;
  allowedSheets?: readonly string[];
}
```

The default allows up to 100 operations and 50,000 touched cells, permits sheet creation and formatting, and blocks formulas. Consumers handling sensitive workbooks should provide an explicit sheet allowlist and smaller budgets.

Future policy work should add preconditions and data classifications before adding more permissions.

## 6. Adapter contract direction

The current `executeInMemory` function proves sequencing and receipt behavior. It is not yet the final public adapter interface.

The next adapter contract shall include:

- stable adapter identifier and version;
- supported plan versions and operation kinds;
- platform limits and normalization rules;
- read-snapshot method;
- preflight capability result;
- preview method where the platform supports it;
- apply method with idempotency and optimistic-concurrency input;
- normalized execution evidence;
- redaction behavior;
- explicit unsupported and partial-failure results.

An adapter must reject the complete plan before mutation if any operation is unsupported.

## 7. Receipt model

`opensheet.receipt.v1` records:

- `planDigest`;
- execution status;
- caller-supplied or adapter clock time;
- executor identifier;
- `beforeDigest` and `afterDigest`;
- optional `projectedAfterDigest` for dry-run;
- per-operation status and touched-cell count;
- policy findings.

Receipt time is not part of plan compilation. In tests, the clock is injected. A future signing design must define canonicalization, key identity, signature coverage, rotation, verification, and what authorization claims remain out of scope.

## 8. Module contract

A module is a deterministic domain compiler. It owns domain validation but emits only core operations.

Current modules:

- `scale-bank.v1`: constructs and measurement-item metadata to a structured reference sheet;
- `gap-map.v1`: expected construct coverage and observed columns to a coverage report.

Future module acceptance requires:

- a repeated developer or operator job;
- typed intent and examples;
- deterministic fixture;
- negative and boundary tests;
- no direct credential or adapter dependency;
- a clear owner and deprecation path.

## 9. Quantitative plugin boundary

Quantitative computation shall be split from presentation. An analysis adapter receives a typed dataset snapshot and analysis specification, invokes a versioned engine, and returns a result artifact containing:

- engine name and version;
- algorithm or estimator;
- input digest;
- normalized variables and missing-data policy;
- warnings, convergence, and failure state;
- result tables and their schema;
- result digest.

A presentation module may then compile that result into a sheet plan. This prevents spreadsheet formatting code from silently becoming a statistical engine.

## 10. Connector boundary

Connectors operate on typed snapshots and mapping specifications. They are not plan compilers unless their output is a spreadsheet mutation plan. A future synchronization protocol must model idempotency, cursor state, conflicts, retries, partial failure, and PII redaction.

Payment initiation and credential custody remain outside the core.

## 11. Package evolution

The foundation begins as one package to avoid premature cross-package versioning. Split only after external use demonstrates stable boundaries.

Expected later packages:

```text
@opensheet-ai/core
@opensheet-ai/adapter-xlsx
@opensheet-ai/adapter-google-sheets
@opensheet-ai/mcp
@opensheet-ai/module-research
@opensheet-ai/conformance
```

The scoped names are design placeholders until organization ownership and registry availability are verified.

## 12. Conformance strategy

Each adapter shall run the same fixture classes:

- empty workbook creation;
- idempotent sheet ensure;
- literal value preservation, including strings beginning with formula-like prefixes;
- rectangular write bounds;
- validation mapping;
- supported format normalization;
- freeze and width mapping;
- blocked formula behavior;
- dry-run non-mutation;
- optimistic-concurrency mismatch;
- unsupported operation fail-closed behavior;
- repeated plan idempotency or declared non-idempotency.

Normalized semantic output, not raw platform file bytes, is the cross-adapter comparison target.

## 13. Deployment model

The core has no server requirement and can run in a CLI, local agent, server function, job runner, or application process. Hosted execution is an adapter concern.

Base URL overrides belong only to remote adapters and must be explicit configuration. They shall not cause the core to fetch code, schemas, or prompts dynamically.
