# OpenSheet-AI Implementation Plan

**Date:** 22 August 2026

**Planning horizon:** foundation through first public integration evidence
**Method:** contract-first, evidence-gated delivery

## 1. Delivery rule

Work proceeds only when the previous layer has a stable contract and proportionate proof. Feature count is not a release signal. A package is not “adopted” because it builds locally, has a public repository, or records registry downloads without dependent use.

## 2. Current milestone: F0 Foundation

### Objective

Prove that typed business intent can produce a deterministic, bounded plan that is validated, governed, previewed, executed in memory, and receipted without network access or an LLM.

### Work packages

| ID | Deliverable | Acceptance evidence | Current state |
| --- | --- | --- | --- |
| F0-001 | Repository and package baseline | clean root, license, CI, package lock | implemented locally |
| F0-002 | Plan v1 TypeScript contract | exported discriminated union | implemented locally |
| F0-003 | Plan v1 JSON Schema | parseable 2020-12 schema | implemented locally |
| F0-004 | A1 range parser | boundary and negative tests | implemented locally |
| F0-005 | Runtime validator | malformed plans fail before policy | implemented locally |
| F0-006 | Canonical JSON and SHA-256 | key-order and error tests | implemented locally |
| F0-007 | Policy engine | budget, allowlist, formula tests | implemented locally |
| F0-008 | In-memory adapter | dry-run, apply, blocked tests | implemented locally |
| F0-009 | Receipt v1 | schema and runtime receipt | implemented locally |
| F0-010 | Scale bank compiler | deterministic example and tests | implemented locally |
| F0-011 | Gap map compiler | four coverage states tested | implemented locally |
| F0-012 | CLI | compile, validate, preview/apply smoke | implemented locally |
| F0-013 | Product and security documents | spec, architecture, threat model, research | implemented locally |

### Exit gate

- `npm run verify` passes;
- both example intents compile;
- compiled plans validate;
- dry-run leaves the input workbook unchanged;
- applied plan produces a different after-digest;
- package dry run exposes only intended files;
- repository remains unpublished unless the owner separately authorizes publication.

## 3. F1 Contract hardening

### Objective

Make the plan contract safe enough for an external adapter implementation.

### Work packages

| ID | Deliverable | Acceptance evidence | Current state |
| --- | --- | --- | --- |
| F1-001 | JSON Schema runtime validator (Ajv, test/CI only) | reconciliation tests vs `assertSheetPlan`; residual gaps documented | implemented locally |
| F1-002 | Adapter capability and preflight | unsupported kinds block before mutation | implemented locally |
| F1-003 | Workbook snapshot and semantic diff | normalized snapshot; dry-run diff empty | implemented locally |
| F1-004 | Operation preconditions | missing sheet / digest mismatch receipts | implemented locally |
| F1-005 | Idempotent replay | opt-in `previousReceipt`; drift still applies | implemented locally |
| F1-006 | Receipt verification | pass + tamper tests | implemented locally |
| F1-007 | Property / fuzz tests | bounded `fast-check` runs | implemented locally |
| F1-008 | Stable error codes | structured `details` plus human-readable `issues` | implemented locally |
| F1-009 | Bundle / cold-start budgets | size gate in `npm run verify` | implemented locally |
| F1-010 | Independent architecture and threat review | `docs/reviews/2026-08-22-f0-architecture-threat-review.md` | implemented locally |

Ledger: `docs/backlog/F1.md`. Compatibility: `docs/COMPATIBILITY.md`.

### Exit gate

- schema/runtime drift suite is green;
- unsupported operations fail before adapter mutation;
- precondition mismatch has a deterministic receipt;
- malicious and oversized fixtures remain bounded;
- the public interface has an explicit compatibility policy.

## 4. F2 First real adapter

### Recommended sequence

**Decision (22 August 2026):** the first real adapter is credential-free `.xlsx`. Evidence: `docs/research/2026-08-22-f1-adapter-choice.md`. There is still no verified Google Sheets or MCP demand. Sheets `batchUpdate` is atomic but has no revision precondition. Do not start both adapters at once.

Build `.xlsx` first for local conformance and reproducible CI. Build Google Sheets later if a host actually needs it. The adapter must write a new file by default and fail closed on unsupported round-trip features. Do not use npm `xlsx@0.18.5`.

**Current state (23 August 2026):** Candidate A is implemented locally as a greenfield ExcelJS writer (`src/adapters/xlsx.ts`, `opensheet-ai/xlsx`, CLI `apply-xlsx`). Overwrite is refused by default. Existing files require a sheet allowlist. Google Sheets remains deferred.

### Candidate A: `.xlsx` adapter

- evaluate maintained libraries for formula preservation, validation, formatting, tables, file size, license, and security;
- read a workbook into a normalized snapshot;
- write supported v1 operations to a new output file by default;
- refuse overwrite unless an explicit option and precondition are supplied;
- verify output through read-back;
- preserve unsupported workbook features or fail closed;
- add clean-room Windows, macOS, and Linux fixture evidence where feasible.

### Candidate B: Google Sheets adapter

- use official `spreadsheets.get` and `spreadsheets.batchUpdate` APIs;
- accept credentials through the host application, never store them in core;
- map a complete plan to one bounded batch where platform limits allow;
- add spreadsheet and sheet allowlists;
- use revision/state preconditions where available;
- maintain recorded API fixtures and an authorized reversible live test;
- clean up live-test artifacts.

### Exit gate

- adapter passes the shared conformance suite;
- output is read back and normalized;
- partial failure and retry behavior is documented;
- no credentials or workbook data appear in fixtures, logs, or receipts;
- support claim is limited to tested operations and versions.

## 5. F3 Developer integration surface

### Objective

Make the core useful to other maintainers without forcing them into one agent framework.

### Work packages

- **F3-001:** publish a prerelease core package after explicit authorization — **not authorized**;
- **F3-002:** adapter authoring guide and conformance harness — `docs/ADAPTER_AUTHORING.md`, `npm run check:conformance`;
- **F3-003:** Node service, CLI, serverless examples — `examples/node-service.mjs`, `examples/serverless-handler.mjs`;
- **F3-004:** optional MCP server — **deferred** (ADR 0001);
- **F3-005:** model-provider examples that require validation — `examples/model-intent/`;
- **F3-006:** capability matrices — `docs/ADAPTER_MATRIX.md`;
- **F3-007:** five external quick-start sessions — **blocked on human hosts**; two local sessions recorded.

### Exit gate

- a clean external repository installs and uses the package;
- an external maintainer can implement a toy adapter from the guide;
- the MCP surface cannot bypass plan validation or policy;
- external usability evidence is recorded with consent.

## 6. F4 Business module expansion

Prioritize modules that demonstrate the same core primitives across different domains. Candidate modules:

1. KPI threshold table with typed validations and alert metadata — **implemented locally** (`compileKpiThreshold`, `examples/kpi-threshold.json`);
2. approval/status workflow scaffold;
3. payroll or sales variance map using formulas only under explicit policy;
4. import schema and field-mapping sheet;
5. research codebook and measurement-quality presentation module.

Each module needs a real user job, a typed contract, fixtures, and external feedback. Do not add a module solely to increase repository size.

## 7. F5 Quantitative plugin protocol

### Safe sequence

1. descriptive statistics and data-quality reports;
2. reliability analysis with explicit missing-data and reverse-key policy;
3. EFA through a mature external engine and reproducible environment;
4. CFA/SEM only after estimator, convergence, fit indices, identification, and provenance contracts are reviewed by qualified contributors;
5. PLS-SEM only as a separately named engine adapter with method-specific outputs.

### Required evidence

- golden datasets with published expected results;
- cross-engine tolerance decisions;
- complete option and version provenance;
- numerical warnings preserved in result artifacts;
- no claim that spreadsheet presentation replaces statistical judgment.

## 8. F6 Connector protocol

Develop a connector SDK only after the snapshot, mapping, idempotency, and receipt contracts are stable.

Initial targets should be read-only imports from a low-risk public or sandbox source. ERP writes and payment flows require separate authorization, reconciliation, and rollback designs.

## 9. F7 Community and adoption

### Product-led path

- publish one narrow, working quick start;
- create adapter and module contributor work packages;
- request review from maintainers of adjacent spreadsheet and MCP projects with a specific interoperability question;
- add a compatibility example rather than asking for stars;
- document each external integration and dependent package with verifiable links;
- keep a public roadmap that distinguishes planned, implemented, native-tested, and released states.

### Metrics

- unique external contributors with merged pull requests;
- independent dependent packages and repositories;
- successful clean-room installs;
- conformance implementations;
- support load and issue resolution;
- registry downloads as a secondary signal, not the sole target.

### Prohibited tactics

- bought or exchanged stars;
- scripted downloads or artificial dependents;
- mass unsolicited comments;
- fabricated pilots, testimonials, contributors, or usage;
- publishing many trivial packages to inflate dependency counts.

## 10. OSS program readiness

The Claude for Open Source thresholds are reviewed as external facts, not promised results. The project should prepare an evidence ledger containing:

- package and repository identity;
- release history;
- dependent repositories and packages;
- monthly registry downloads with date range;
- external contributor identities and merged pull requests;
- current OpenSSF criticality result and tool version;
- security practices and release process;
- explanation of quiet ecosystem influence where quantitative thresholds are not met.

An application should be filed only with evidence that is current at the application date.

## 11. First 30-day execution order

Ledger: `docs/backlog/WEEKS-1-3.md`. Compressed locally on 23 August 2026.

### Week 1

- [x] complete F0 verification and source review;
- [x] reconcile runtime validator and JSON Schema gaps;
- [x] record package contents and CLI smoke output (`scripts/check-pack.mjs`, `scripts/cli-smoke.mjs`);
- [x] create tracked issues from F1 work packages (`docs/backlog/F1.md`; no public remote).

### Week 2

- [x] design capability, snapshot, precondition, and semantic diff contracts;
- [x] choose the first real adapter using an evidence matrix;
- [x] build recorded conformance fixtures (`test/fixtures/conformance/`).

### Week 3

- [x] implement the adapter read path and preflight;
- [x] implement write-to-new-target behavior;
- [x] add read-back verification and failure receipts.

### Week 4

- [x] run clean-room tests (`scripts/clean-room.mjs`);
- [x] two **local** quick-start sessions recorded (`docs/evidence/2026-08-23-quickstart-sessions.md`); external hosts still required for F3-007;
- [x] revise API ergonomics (`opensheet-ai/memory`, `opensheet-ai/xlsx`);
- [x] decide to remain unpublished (`docs/decisions/0005-remain-unpublished.md`).

## 12. Decision checkpoints

Stop and re-evaluate if any of these occur:

- a mature adjacent project already exposes the same portable contract and welcomes contributions;
- the first five external users want direct workbook access but do not value plan portability or receipts;
- adapter differences make the current operation model misleading;
- support and security burden exceeds maintainer capacity;
- quantitative features dominate demand before the core is stable.

The correct response may be integration with an existing project rather than continued independent expansion.
