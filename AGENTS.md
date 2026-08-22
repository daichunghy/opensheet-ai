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

- `src/core/`: versioned contracts, validation, canonicalization, policy, and range utilities.
- `src/modules/`: business-intent compilers that produce core plans.
- `src/adapters/`: execution boundaries; the current adapter is in-memory only.
- `schemas/`: public JSON Schema contracts.
- `examples/`: executable typed-intent examples.
- `test/`: determinism, negative, policy, module, and adapter tests.
- `docs/`: product, architecture, research, security, and delivery decisions.

## Required verification

Run `npm run verify` after meaningful changes. Add negative or regression coverage for every contract, policy, or execution-boundary change.

The repository is a local foundation prototype until publication is explicitly authorized.
