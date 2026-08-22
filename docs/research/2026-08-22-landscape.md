# Spreadsheet and Agent Middleware Landscape

**Research date:** 22 August 2026

**Decision supported:** define a defensible OpenSheet-AI product boundary and delivery sequence
**Confidence:** moderate for the selected open-source sample; high for the cited first-party program criteria; low for any claim that no similar implementation exists anywhere

## 1. Bottom line

The original “agentic data middleware for spreadsheets” direction is useful, but the proposed feature set is too broad and overlaps strongly with existing spreadsheet agents, MCP servers, headless spreadsheet engines, and office SDKs.

The most defensible project is narrower:

> OpenSheet-AI is a provider-neutral, deterministic plan-and-execution protocol that lets an agent or application propose spreadsheet changes, validate them, apply policy, preview them, execute them through an adapter, and receive a state-bound receipt.

The opportunity is not proven to be uncontested. In particular, `spreadsheet-kit` already advertises a backend-agnostic SDK, dry-run workflows, event-sourced editing, and verification surfaces. `@iota-uz/sheets-mcp` compiles typed agent-authored scripts to atomic Google Sheets updates. OpenSheet-AI must therefore prove that a small cross-adapter plan contract and policy/receipt layer is useful to these projects or their users. If external validation does not support this, contributing the contract to an adjacent project may be better than maintaining a separate repository.

## 2. Claude for Open Source criteria are confirmed

Anthropic's current Claude for Open Source page states that the program provides six months of Claude Max 20x. It lists the following routes:

- 500 dependent repositories, 100 dependent packages, or 200,000 combined monthly registry downloads for maintainers and library authors;
- recognized core committer or maintainer status;
- 100 merged pull requests into repositories the applicant does not own in the prior 12 months;
- 20 unique external contributors with merged pull requests in one repository in the prior 12 months;
- an OpenSSF criticality score of at least 0.4;
- an exception path for quietly depended-on ecosystem work.

Source: [Anthropic, Claude for Open Source](https://claude.com/contact-sales/claude-for-oss).

These are application routes, not architecture requirements. Selecting “infrastructure” can improve the chance of legitimate dependents, but it does not create adoption. Download or dependency thresholds should remain external evidence gates rather than development targets that distort package design.

## 3. OpenSSF criticality is an outcome of ecosystem signals

The OpenSSF Criticality Score project describes a score from 0 to 1 based on repository signals such as project age, recent activity, contributors, organizations, commits, releases, issues, comments, and dependency indicators. It publishes data for GitHub-hosted projects and labels the project beta.

Source: [OpenSSF Criticality Score repository](https://github.com/ossf/criticality_score).

Implication: adding CI, a security policy, or an OpenSSF badge does not itself produce a score of 0.4. The practical strategy is to build a genuinely depended-on package, maintain it actively, invite real contributors, and measure the score later with the current official tool.

## 4. Adjacent project map

| Category | Representative project | What it already provides | Implication for OpenSheet-AI |
| --- | --- | --- | --- |
| Full office/spreadsheet SDK | [Univer](https://github.com/dream-num/univer) | isomorphic office SDK, plugin architecture, formula engine, browser and Node.js surfaces, headless AI use | do not build a new grid UI or formula engine |
| Headless calculation engine | [HyperFormula](https://github.com/handsontable/hyperformula) | TypeScript formula parser/evaluator with hundreds of functions; GPLv3 or commercial license | quantitative/presentation features should integrate through a clear license boundary |
| Open spreadsheet engine | [IronCalc](https://github.com/ironcalc/ironcalc) | Rust engine, xlsx reader/writer, multi-language direction, MIT/Apache licensing | consider as a future calculation/runtime adapter rather than reimplementing spreadsheet semantics |
| Google Sheets MCP | [@iota-uz/sheets-mcp](https://github.com/iota-uz/sheets-mcp) | typed sheet API, script compilation, atomic `batchUpdate`, idempotency, Google-specific execution | a generic plan must provide value below or beside this layer, not reproduce its tool catalogue |
| Excel/spreadsheet MCP and SDK | [spreadsheet-kit](https://github.com/PSU3D0/spreadsheet-mcp) | CLI, MCP, backend-agnostic SDK, safe mutations, dry-run, event-sourced sessions, verification, impact analysis | strongest counterexample to a novelty claim; validate interoperability before public positioning |
| Excel MCP | [SheetForge MCP](https://github.com/iHeldan/sheetforge-mcp) | local `.xlsx` reads/writes, layout awareness, formulas, validation, charts, pivots, multiple transports | do not compete on number of workbook tools in the foundation |
| Excel agent research | [Microsoft SheetBrain](https://github.com/microsoft/SheetBrain) | LLM-driven understand-execute-validate workflow with code execution | keep model reasoning and arbitrary code outside the core trust boundary |
| Evaluation | [SpreadsheetBench](https://github.com/RUCKBReasoning/SpreadsheetBench) | real-world manipulation instructions and multi-case evaluation | later adapters need benchmark-derived fixtures, but benchmark success is not equivalent to safe integration |

## 5. Technical platform implications

Google documents that `spreadsheets.batchUpdate` validates every request before applying the batch and applies valid updates together atomically, while also warning that collaborators can alter the resulting spreadsheet state.

Source: [Google Sheets API `spreadsheets.batchUpdate`](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate), last updated 23 July 2026.

This makes Google Sheets a plausible adapter for a complete plan-to-batch mapping. It does not remove the need for:

- permission and sheet allowlists;
- plan budgets;
- capability checks;
- pre-write state evidence;
- post-write read-back;
- retry and ambiguous-result handling;
- collaboration-aware state reconciliation.

## 6. The actual gap

The research sample shows mature activity in four layers:

1. end-user spreadsheet applications;
2. full spreadsheet engines and SDKs;
3. agent and MCP tool surfaces that directly read or mutate workbooks;
4. agent benchmarks and reasoning systems.

The narrower candidate gap is a small package that standardizes this boundary:

```text
untrusted typed intent
-> deterministic portable mutation plan
-> explicit policy decision
-> adapter capability/precondition check
-> normalized preview/apply receipt
```

This is a hypothesis, not a confirmed empty market. The first external research task is to ask maintainers of adjacent projects whether they would consume or help shape such a contract.

## 7. Why the original three-part product should be reordered

### Automation base: retain, but make it declarative

Direct script generation creates a code-execution boundary and platform lock-in. The first core should emit declarative operations. Platform-specific code generation, if ever required, belongs in a reviewed adapter.

### Quantitative engine: postpone and modularize

Formula calculation already has established engines. Multivariate analysis and SEM add substantial scientific correctness obligations. The correct boundary is a typed analysis request and result artifact produced by a mature versioned engine, followed by a spreadsheet presentation plan.

### Connectors: postpone until snapshot and idempotency contracts exist

ERP and payment connections introduce credentials, PII, retries, conflicts, and external side effects. Building them before plan preconditions and receipts would weaken the core.

## 8. Recommended first wedge

Use research/business structure generation to prove the protocol without claiming complete spreadsheet automation:

- `scale-bank.v1` demonstrates typed domain input, literal values, formatting, deterministic output, and citations/source fields;
- `gap-map.v1` demonstrates comparison logic and a derived status report;
- a later KPI threshold module can demonstrate validations and explicitly authorized formulas;
- one `.xlsx` or Google Sheets adapter can then prove portability.

The initial modules should be examples of the infrastructure, not the only reason the package exists.

## 9. Name and packaging check

On 22 August 2026, `npm view opensheet-ai` and `npm view @opensheet-ai/core` returned registry 404 responses, and no repository named `daichunghy/opensheet-ai` was found. This is a point-in-time availability check only. It does not reserve a name, search all registries and organizations, or establish trademark clearance.

The local package therefore remains `private: true` and `0.0.0-dev`.

## 10. Disconfirming test

The project thesis should be rejected or revised if interviews and integration trials show that:

- maintainers prefer their current internal command models and do not want a shared plan;
- cross-adapter normalization hides important platform semantics;
- policy and receipts belong more naturally in an existing general agent-governance project;
- users value direct workbook access but not plan inspection or portability;
- an adjacent project offers the same contract with better adoption and governance.

This challenge is important because infrastructure value comes from reuse, not from architectural elegance alone.

## 11. Confidence and gaps

**High confidence:** Anthropic criteria, OpenSSF score mechanics at a high level, and the cited project capabilities stated in their current first-party documentation.

**Moderate confidence:** the plan/policy/receipt boundary is a useful differentiation from many direct-write tools.

**Low confidence:** global novelty. The search was broad enough to find strong counterexamples but cannot prove that nobody has implemented the same pattern.

The next evidence that would most change the decision is structured feedback from three maintainers of adjacent spreadsheet SDK/MCP projects and two developers building spreadsheet features.
