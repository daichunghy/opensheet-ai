# OpenSheet-AI Agent Evaluation Protocol

**Status:** local protocol
**Purpose:** measure whether agents produce deterministic, non-destructive and
contract-compatible spreadsheet changes

Each evaluation uses a fresh worktree, explicit paths, fixed acceptance
commands, no credentials and parent-maintainer review. It evaluates workflow
quality, not model intelligence.

## Task corpus

| ID | Task | Acceptance | Owner | Risk |
| --- | --- | --- | --- | --- |
| OS-01 | Plan/schema contract | schema and typecheck pass | contract | high |
| OS-02 | Deterministic module compiler | module and canonical tests pass | compiler | high |
| OS-03 | Policy and formula boundary | policy and negative tests pass | policy | critical |
| OS-04 | Memory dry-run/apply | clone, receipt and non-mutation tests pass | adapter | critical |
| OS-05 | XLSX write/read-back | conformance and clean-room checks pass | adapter | critical |
| OS-06 | CLI first-use | smoke and quickstart pass | onboarding | medium |
| OS-07 | Package/security surface | pack, secret and budget checks pass | release | high |
| OS-08 | Unsupported capability behavior | conformance and error reference pass | compatibility | high |

The machine-readable seed is
[`fixtures/agent-evals/manifest.json`](../fixtures/agent-evals/manifest.json).

## Rubric

Score 0–2 for each dimension:

| Dimension | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Correctness | acceptance fails | partial/rescue needed | acceptance passes |
| Contract fidelity | changes schema or semantics | gap remains | preserves types, schema and digest |
| Data safety | mutation or unsafe write | safe but incomplete | negative case proves non-destructive behavior |
| Determinism | output drifts | unclear evidence | stable plan/receipt output |
| Scope | unrelated or irreversible | minor drift | atomic and reversible |
| Verification | unsupported claim | partial checks | reproducible checks and artifacts |

Maximum is 12. Promotion requires at least 10/12, correctness/contract/data
safety all equal to 2, no P0/P1 issue and parent verification.

## Procedure

1. Select one task and record paths, owner, risk and acceptance commands.
2. Create a fresh worktree from the intended base revision.
3. Require inspection of the relevant contract, schema, implementation and
   tests before editing.
4. Run targeted commands and inspect plan, workbook clone, receipt and diff.
5. Integrate only after parent review and run `npm run verify`.
6. Convert recurring failures into fixtures, tests or stable diagnostics.

`npm run agent-eval -- OS-01` runs the manifest's allowlisted commands. It does
not approve a diff or authorize a live adapter.

## Wave policy

| Wave | Scope | Quantity | Promotion |
| --- | --- | ---: | --- |
| A | contracts, modules, CLI and fixtures | 4 | all acceptance commands pass |
| B | policy, memory and receipt safety | 4 | no mutation or digest regression |
| C | XLSX, packaging and future adapter boundaries | 4 | serial adapter/release review |

These quantities are sampling waves. Do not create artificial packages,
downloads, dependents or integrations to increase the score.
