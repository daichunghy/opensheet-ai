# OpenSheet-AI Product Specification

**Version:** 0.1 draft

**Date:** 22 August 2026

**Status:** approved for foundation implementation
**Current proof level:** local static and in-memory runtime proof only

## 1. Executive decision

OpenSheet-AI will be developed as a provider-neutral plan-and-execution protocol for agent-driven spreadsheet automation.

The project will not compete initially as a spreadsheet application, an LLM wrapper, or a large MCP tool catalogue. Its reusable unit is a versioned operation plan that sits between an untrusted intent producer and a spreadsheet adapter:

```text
typed intent -> deterministic module compiler -> validated SheetPlan
            -> policy decision -> dry-run/apply adapter -> execution receipt
```

This scope is narrower than the original proposal but stronger as infrastructure. It creates a stable dependency surface for applications, MCP servers, workflow engines, research tools, templates, and connectors without requiring them to share one model provider or spreadsheet runtime.

## 2. Problem statement

AI spreadsheet projects commonly bind three concerns together:

1. a model interprets natural language;
2. a tool implementation decides how to modify a workbook;
3. the same tool writes directly to Excel or Google Sheets.

This coupling causes predictable integration problems:

- plans are difficult to inspect before execution;
- model output, business rules, and platform credentials share one trust boundary;
- similar operations are reimplemented for every agent and spreadsheet backend;
- write behavior is difficult to test without live credentials or a desktop runtime;
- application developers cannot reliably switch models or adapters;
- audit records describe what a tool claims to have done rather than binding the exact plan, policy outcome, and workbook state.

OpenSheet-AI addresses the middleware contract, not the quality of language-model reasoning itself.

## 3. Product thesis

Developers will adopt OpenSheet-AI if it lets them add safe, inspectable spreadsheet automation with less adapter-specific code and lower operational risk than direct model-to-workbook tools.

The initial adoption wedge is not “run any spreadsheet task.” It is:

> Compile common business and research structures into portable, reviewable spreadsheet plans that can be previewed, governed, tested, and later executed through more than one adapter.

## 4. Target users and jobs

### 4.1 Primary users

- developers building AI-assisted Excel or Google Sheets features;
- maintainers of MCP servers and agent toolkits who need a lower-level plan contract;
- SaaS and internal-tool teams that need spreadsheet exports with policy controls;
- researchers and analytics developers who need repeatable workbook structures;
- connector authors who need a common representation before mapping data to a platform API.

### 4.2 Initial jobs to be done

- “Given validated business metadata, produce the same spreadsheet structure every time.”
- “Show me exactly which sheets, ranges, values, formulas, and formats an agent proposes to change.”
- “Block plans that exceed a cell budget, touch the wrong sheet, create sheets, write formulas, or format cells without permission.”
- “Test workbook-changing logic without Google credentials, Microsoft Excel, or model calls.”
- “Execute the same accepted plan through different adapters without changing the upstream intent compiler.”

## 5. Product definition

OpenSheet-AI consists of five conceptual layers.

### 5.1 Intent layer

Typed, versioned business requests such as `scale-bank.v1` and `gap-map.v1`. Intent producers may be applications, humans, CLI clients, MCP servers, or LLM integrations. Natural language is not a core input contract.

### 5.2 Compiler layer

Pure functions that validate an intent and produce `opensheet.plan.v1`. A compiler must be deterministic and must not access credentials, networks, files, model providers, or the wall clock.

### 5.3 Plan and policy layer

The plan is the portable intermediate representation. Policy evaluation happens after structural validation and before execution. Policy results are explicit and fail closed.

### 5.4 Adapter layer

Adapters map supported plan operations to a concrete runtime. The foundation includes only an immutable in-memory adapter. Planned adapters include `.xlsx`, Google Sheets, and selected headless spreadsheet runtimes.

### 5.5 Receipt layer

Every preview or execution returns a versioned receipt that binds:

- the SHA-256 digest of the exact plan;
- status (`dry-run`, `applied`, or `blocked`);
- executor identity string;
- input and output workbook-state digests;
- per-operation status and touched-cell counts;
- policy findings.

The receipt proves what this adapter evaluated or applied to the represented workbook state. It does not prove semantic correctness, authorization by a human, a live cloud write, or release readiness unless those claims have separate evidence.

## 6. Foundation functional requirements

### FR-001: Versioned plan contract

The system shall expose `opensheet.plan.v1` as TypeScript types and JSON Schema.

### FR-002: Deterministic plan compilation

The same valid typed intent shall produce byte-equivalent canonical JSON and the same SHA-256 digest.

### FR-003: Explicit operation types

Version 1 shall support:

- ensure sheet;
- write literal range;
- write formula range;
- set data validation;
- set format;
- freeze pane;
- set column widths.

Values and formulas shall remain separate operation types.

### FR-004: A1 range validation

Ranges shall be bounded to Excel-compatible rows and columns. Reversed, malformed, out-of-bounds, and dimension-mismatched ranges shall be rejected before policy evaluation.

### FR-005: Policy evaluation

The foundation policy shall support:

- maximum operations;
- maximum total touched cells;
- sheet allowlist;
- sheet-creation permission;
- formula-write permission;
- formatting permission.

Formula writes shall be blocked by default.

### FR-006: Non-mutating dry-run

Dry-run shall calculate the prospective workbook digest without modifying caller-owned state. The returned receipt shall keep `afterDigest` equal to `beforeDigest` and place the prospective state in `projectedAfterDigest`.

### FR-007: In-memory execution

The in-memory adapter shall apply an allowed plan to a clone of the workbook and return the changed clone plus a receipt.

### FR-008: Scale bank compiler

The first business module shall convert validated constructs, scale bounds, item codes, item text, reverse-key flags, and source notes into a formatted scale-bank plan.

The example content must state that demonstration items are not validated measurement instruments.

### FR-009: Gap map compiler

The second module shall compare expected construct coverage against observed worksheet columns and classify each construct as `covered`, `partial`, `missing`, or `unexpected`.

### FR-010: CLI

The CLI shall compile supported intent JSON, validate plan JSON, and preview or apply a plan through the in-memory adapter. It shall print JSON to standard output and failures to standard error.

## 7. Non-functional requirements

### NFR-001: Runtime portability

The core package shall support maintained Node.js 20 and 22 release lines at initial publication. Platform adapters may declare narrower requirements.

### NFR-002: Minimal dependency surface

The core shall prefer standard-library primitives. New production dependencies require an explicit architecture decision covering maintenance, security, size, and license.

### NFR-003: Determinism

Planner output shall exclude implicit timestamps, random identifiers, environment-dependent values, and provider responses. Callers may supply identifiers as typed input when needed.

### NFR-004: Security defaults

The default policy shall allow bounded literal writes and basic structure creation while blocking formulas. Future destructive operations, external calls, script generation, macros, and connector writes shall be disabled until separately modeled.

### NFR-005: Explainability

Validation and policy failures shall have stable machine codes where appropriate and actionable messages. Adapters shall not silently downgrade unsupported operations.

### NFR-006: Package stability

Public schemas and exported TypeScript types shall follow semantic versioning after the first public prerelease. Breaking plan changes require a new schema version or a major package release.

### NFR-007: Testability

Each compiler and adapter shall have deterministic positive, negative, boundary, and non-mutation tests. Live adapters shall also have recorded fixtures and an authorized reversible end-to-end test.

## 8. Deliberate non-goals for the foundation

- natural-language parsing or prompt templates;
- direct OpenAI, Anthropic, Google, or local-model integration;
- an MCP server;
- an Office add-in or Google Workspace add-on;
- `.xlsx` file I/O;
- live Google Sheets writes;
- formula calculation or spreadsheet recalculation;
- SPSS, AMOS, EFA, CFA, SEM, PLS-SEM, or statistical inference;
- ERP, accounting, school-management, or payment synchronization;
- credential storage, hosted multi-tenancy, billing, or user authentication;
- arbitrary code or script generation;
- destructive sheet, row, column, table, or workbook operations.

These exclusions prevent an early prototype from implying capabilities it cannot yet verify.

## 9. Quantitative engine decision

The original proposal placed multivariate analysis and SEM inside the initial spreadsheet framework. That is not appropriate for the first core release.

Statistical engines carry separate correctness, numerical stability, missing-data, estimator, convergence, fit-index, licensing, and provenance requirements. OpenSheet-AI will therefore treat quantitative analysis as a plugin protocol:

```text
tabular snapshot + analysis specification
-> verified external engine
-> typed result artifact with engine/version/options/warnings
-> compiler creates a presentation plan
```

The project may later provide adapters for mature engines such as R or Python libraries. It shall not implement SEM mathematics from scratch merely to expand feature count.

## 10. Connector decision

ERP and payment connectors shall not write directly through the core. A connector must produce or consume a typed snapshot with:

- source and destination identifiers;
- schema version;
- field mapping;
- cursor or synchronization boundary;
- idempotency key;
- data classification;
- conflict policy;
- redaction policy;
- execution receipt.

Payment initiation is outside the spreadsheet adapter boundary and requires a separate authorization model.

## 11. API stability and extensibility

### 11.1 Operation registry

The core uses a closed operation union for each schema version. A plugin may compile intents but cannot inject arbitrary executable code into a plan.

### 11.2 Adapter capability declaration

Before public adapters are added, the adapter interface shall expose a capability manifest. Execution must fail before mutation when a plan contains an unsupported operation.

### 11.3 Plan compatibility

- readers shall reject unknown major schema versions;
- adapters shall declare supported operation kinds and plan versions;
- compilers shall pin the plan schema they emit;
- receipts shall pin both plan digest and receipt schema.

## 12. Success measures

Grant thresholds are external eligibility conditions, not product acceptance criteria. The project will track leading evidence instead.

### 12.1 Product evidence

- five external developers complete the local quick start without maintainer intervention;
- three independent applications use the exported compiler or plan contract;
- two adapters execute the same conformance plan with equivalent normalized results;
- at least one external MCP/tool project delegates planning or policy to OpenSheet-AI;
- contract conformance fixtures are used outside the repository.

### 12.2 Community evidence

- first-time issue response within a published service target;
- contributor documentation and `good first issue` work packages;
- independent pull requests with test coverage;
- release notes and migration guidance for contract changes;
- no purchased, exchanged, or fabricated stars, downloads, dependents, or contributions.

### 12.3 Reliability evidence

- deterministic fixture replay across Node.js 20 and 22;
- zero mutation on blocked or dry-run paths;
- clean package contents from `npm pack --dry-run`;
- high-severity production dependency audit passes;
- adapter conformance failures are explicit and non-destructive.

## 13. Release gates

### Foundation complete

- requirements FR-001 through FR-010 implemented;
- local `npm run verify` passes;
- examples compile and validate;
- package dry run includes only intended files;
- no public-support or adoption claim.

### Public prerelease candidate

- package and repository names rechecked;
- name and license review completed;
- runtime validator reconciled against JSON Schema;
- capability contract and at least one real read/write adapter implemented;
- clean-room install test;
- security review and secret scan;
- public repository, CI, issue templates, contribution and support policy;
- explicit owner authorization to publish.

### Stable release candidate

- at least two adapters pass the same conformance suite;
- migration and deprecation policy tested;
- external usability and integration evidence recorded;
- support capacity and vulnerability-response process established;
- no open critical contract or data-integrity defects.

## 14. Principal risks

- **Crowded market:** safe spreadsheet MCP and SDK projects already exist. Mitigation: remain focused on the portable plan, policy, and receipt contract and integrate rather than imitate.
- **Premature breadth:** SEM, ERP, payment, and model providers can fragment the project. Mitigation: contract-first phases and evidence gates.
- **False portability:** spreadsheet platforms differ in formulas, formatting, tables, recalculation, and limits. Mitigation: capability manifests, normalized conformance fixtures, and explicit unsupported results.
- **Adoption metric fixation:** package downloads can be automated or incidental. Mitigation: prioritize external integrations, dependent packages, contributors, and reproducible usage evidence.
- **Data harm:** a correct operation plan can still overwrite important cells. Mitigation: default dry-run, budgets, allowlists, non-destructive v1 operations, preconditions, and future rollback artifacts.

## 15. Open decisions

- final project and npm scope ownership;
- whether the first real adapter should target Google Sheets batch updates or `.xlsx` through a maintained library;
- capability and conformance schema details;
- precondition format for optimistic concurrency;
- receipt signing or hash-chain requirements;
- public governance model after external contributors arrive.
