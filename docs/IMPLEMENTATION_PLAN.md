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

- **F1-001:** add a shared JSON Schema runtime validator and reconciliation tests against TypeScript validation;
- **F1-002:** add adapter capability and preflight schemas;
- **F1-003:** add workbook snapshot and normalized semantic diff contracts;
- **F1-004:** add operation preconditions, including sheet existence and range-state digest;
- **F1-005:** define idempotency behavior and duplicate-plan handling;
- **F1-006:** add receipt verification, canonical payload definition, and tamper tests;
- **F1-007:** add property-based or fuzz tests for range and matrix validation;
- **F1-008:** define errors as stable codes with structured context;
- **F1-009:** measure bundle and cold-start budgets;
- **F1-010:** run an independent architecture and threat review.

### Exit gate

- schema/runtime drift suite is green;
- unsupported operations fail before adapter mutation;
- precondition mismatch has a deterministic receipt;
- malicious and oversized fixtures remain bounded;
- the public interface has an explicit compatibility policy.

## 4. F2 First real adapter

### Recommended sequence

Build `.xlsx` first if the goal is credential-free local conformance and reproducible CI. Build Google Sheets first if immediate integration with agent/MCP projects has verified demand. Do not build both simultaneously until the adapter contract is stable.

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

- **F3-001:** publish a prerelease core package after explicit authorization;
- **F3-002:** add a minimal adapter authoring guide and conformance harness;
- **F3-003:** provide examples for a Node service, CLI, and serverless function;
- **F3-004:** add an optional MCP server that accepts typed intents or plans, rather than arbitrary scripts;
- **F3-005:** add model-provider examples that produce typed intent and require validation before compilation;
- **F3-006:** publish capability matrices and unsupported cases;
- **F3-007:** run five external quick-start sessions and fix friction before broader outreach.

### Exit gate

- a clean external repository installs and uses the package;
- an external maintainer can implement a toy adapter from the guide;
- the MCP surface cannot bypass plan validation or policy;
- external usability evidence is recorded with consent.

## 6. F4 Business module expansion

Prioritize modules that demonstrate the same core primitives across different domains. Candidate modules:

1. KPI threshold table with typed validations and alert metadata;
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

### Week 1

- complete F0 verification and source review;
- reconcile runtime validator and JSON Schema gaps;
- record package contents and CLI smoke output;
- create tracked issues from F1 work packages.

### Week 2

- design capability, snapshot, precondition, and semantic diff contracts;
- choose the first real adapter using an evidence matrix;
- build recorded conformance fixtures before adapter code.

### Week 3

- implement the adapter read path and preflight;
- implement write-to-new-target behavior;
- add read-back verification and failure receipts.

### Week 4

- run clean-room tests;
- conduct two external quick-start sessions;
- revise API ergonomics;
- decide whether a private prerelease, public prerelease, or more hardening is justified.

## 12. Decision checkpoints

Stop and re-evaluate if any of these occur:

- a mature adjacent project already exposes the same portable contract and welcomes contributions;
- the first five external users want direct workbook access but do not value plan portability or receipts;
- adapter differences make the current operation model misleading;
- support and security burden exceeds maintainer capacity;
- quantitative features dominate demand before the core is stable.

The correct response may be integration with an existing project rather than continued independent expansion.
