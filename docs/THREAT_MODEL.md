# OpenSheet-AI Threat Model

**Status:** foundation model
**Date:** 22 August 2026

## 1. Scope

This model covers typed intent compilation, `opensheet.plan.v1` validation, policy evaluation, the in-memory adapter, and receipt generation. It identifies requirements for future file, cloud, model, statistical, and connector adapters but does not claim they are secure or implemented.

## 2. Assets

- workbook values, formulas, structure, and metadata;
- business and research data contained in typed intents;
- plan, policy, snapshot, and receipt integrity;
- adapter credentials and authorization context;
- user trust in preview, execution, and audit output;
- package and release supply-chain integrity.

## 3. Actors

- application developer integrating the package;
- end user requesting a spreadsheet change;
- intent producer, including an LLM or MCP client;
- module author;
- adapter author;
- repository maintainer and contributor;
- attacker controlling intent, plan, workbook content, connector data, dependency, or network response.

## 4. Trust boundaries

```text
untrusted natural language or external data
                |
                v
       intent producer boundary
                |
      typed intent, still untrusted
                |
                v
 compiler and runtime validation boundary
                |
          validated plan
                |
                v
          policy boundary
                |
          permitted plan
                |
                v
 adapter capability + authorization boundary
                |
                v
 workbook or external platform + receipt
```

Credentials never belong above the adapter boundary.

## 5. Threats and controls

| ID | Threat | Foundation control | Remaining work |
| --- | --- | --- | --- |
| T-001 | Malformed range causes oversized or unintended write | restricted parser, Excel bounds, matrix checks, cell budget | fuzz and property tests |
| T-002 | Formula injection disguised as text | separate value and formula operations | adapter read-back must preserve literal strings |
| T-003 | Agent writes formulas without consent | formulas blocked by default | formula allowlist and function policy |
| T-004 | Plan touches unauthorized sheets | optional sheet allowlist | make allowlist mandatory for live adapters |
| T-005 | Dry-run mutates workbook | immutable clone and regression test | adapter conformance for real runtimes |
| T-006 | Policy is evaluated after partial mutation | explicit validate-policy-execute sequence | transactional/preflight guarantees per adapter |
| T-007 | Plan or receipt is altered | canonical SHA-256 plan and state digests | signing, verification, custody, and replay model |
| T-008 | Receipt is mistaken for correctness or authorization | documented evidence boundary | human-approval receipt design if required |
| T-009 | Time or randomness breaks replay | no implicit time in compiler; injected test clock | deterministic identifiers for all modules |
| T-010 | Unsupported operation is silently ignored | closed operation union | capability preflight before real adapters |
| T-011 | Live adapter overwrites stale workbook state | not in foundation | optimistic concurrency and state preconditions |
| T-012 | Credential leakage | no credentials or network in core | host-supplied tokens, redaction, secret scanning |
| T-013 | Customer data appears in logs or receipts | receipts store digests and metadata only in foundation | field-level data classification and redaction |
| T-014 | Arbitrary script execution | no executable code in plan | keep MCP and connector surfaces declarative |
| T-015 | Dependency compromise | no production dependencies in foundation | lockfile, audit, provenance, release hardening |
| T-016 | Statistical result is wrong but formatted convincingly | statistical engine excluded from core | golden datasets, engine/version provenance |
| T-017 | Connector retries duplicate external writes | connectors excluded from core | idempotency keys and reconciliation protocol |
| T-018 | Payment action is triggered by spreadsheet mutation | payment execution excluded | separate human authorization and ledger boundary |

## 6. Security invariants

- Unknown plan versions and operation kinds fail closed.
- Structural validation completes before policy evaluation.
- Policy evaluation completes before execution.
- Formula intent is explicit and blocked by default.
- No destructive operation exists in plan version 1.
- Dry-run leaves caller-owned state unchanged.
- A blocked plan emits no changed workbook state.
- Core planning uses no credentials, network, environment-dependent data, implicit time, or arbitrary code.
- Adapters shall reject a plan before mutation if any operation is unsupported.
- Logs and receipts shall not contain raw credentials.

## 7. Abuse cases to add before live adapters

- workbook with formula-like literal strings, hidden sheets, merged ranges, protection, external links, macros, and unsupported objects;
- plan just below and above row, column, operation, payload, and cell budgets;
- duplicate plan delivery and replay after workbook drift;
- API timeout before and after a remote commit;
- partial batch failure and ambiguous result;
- malicious sheet names, Unicode confusables, and log-control characters;
- symlink, path traversal, overwrite, and temporary-file attacks for `.xlsx` output;
- OAuth token leakage through exceptions, support bundles, or recorded fixtures;
- connector records containing formula injection, PII, and adversarial prompt content;
- statistical dataset with missing, infinite, singular, non-convergent, and mislabeled inputs.

## 8. Receipt limitations

The current receipt is an unsigned structured record. A matching digest demonstrates integrity only when the verifier also possesses trusted input data and the same canonicalization rules. It does not establish who authorized the plan, whether a live platform committed it, or whether later state remained unchanged.

Do not describe foundation receipts as cryptographic authorization, non-repudiation, or compliance evidence.

## 9. Release requirements

Before a public package or live adapter:

- reconcile TypeScript validation and JSON Schema;
- add a security test corpus;
- run secret and package-content scans;
- document supported and unsupported workbook features;
- define preconditions, idempotency, partial failure, and cleanup;
- perform an independent review;
- establish private vulnerability reporting;
- verify public CI and release artifacts after publication.
