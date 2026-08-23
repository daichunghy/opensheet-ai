# AGENTS.md

This repository builds OpenSheet-AI, a provider-neutral and deterministic middleware contract for agent-driven spreadsheet automation.

Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/THREAT_MODEL.md` before substantive implementation work.

## Non-negotiable boundaries

- Keep the core deterministic. No network access, credentials, model calls, or wall-clock time in planning functions.
- Treat natural-language interpretation as untrusted input. Only validated typed intent may enter a module compiler.
- Separate literal values from formulas. Never infer a formula from a string prefix.
- Validate before policy evaluation and evaluate policy before execution.
- Keep dry-run non-mutating. Adapters must not modify caller-owned state.
- Do not claim support for Excel, Google Sheets, SEM, ERP, or payment systems until the relevant adapter has native end-to-end evidence.
- Do not claim OSS grant eligibility, adoption, registry downloads, dependent repositories, or OpenSSF criticality from local tests.

## Source layout

- `src/core/`: versioned contracts, validation, canonicalization, policy, range utilities, capability, snapshot, preconditions, idempotency, receipt verification, and stable error codes.
- `src/modules/`: business-intent compilers that produce core plans (`scale-bank`, `gap-map`, `kpi-threshold`).
- `src/adapters/`: execution boundaries (`memory`, greenfield `xlsx`). Core must not import ExcelJS.
- `schemas/`: public JSON Schema contracts (`plan`, `receipt`, `capability`, `snapshot`).
- `examples/`: executable typed-intent examples.
- `test/`: determinism, negative, policy, module, adapter, schema-reconciliation, property, and conformance tests. Recorded fixtures live in `test/fixtures/conformance/`.
- `docs/`: product, architecture, research, security, compatibility, budgets, and delivery decisions.

## Required verification

Run `npm run verify` after meaningful changes. Add negative or regression coverage for every contract, policy, or execution-boundary change.

The repository is a public alpha only after the owner-authorized repository and package publication have been verified. Keep external-adapter, adoption, and production claims fail-closed until their evidence exists.
