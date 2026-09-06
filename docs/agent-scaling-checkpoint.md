# Agent scaling checkpoint — 2026-08-27

**Evidence level:** local and fixture-verified

The repository now contains an OpenSheet-specific [verification
map](agent-verification-map.md), [evaluation protocol](agent-evaluation-protocol.md),
machine-readable corpus at `fixtures/agent-evals/manifest.json`, and an
allowlisted `npm run agent-eval -- <OS-task-id>` runner. The contract checker is
part of `npm run verify`.

## Acceptance baseline

All eight manifest tasks passed on the current tree:

```text
OS-01 plan/schema contract: pass
OS-02 deterministic module compiler: pass
OS-03 policy/formula boundary: pass
OS-04 memory dry-run/apply: pass
OS-05 XLSX write/read-back: pass
OS-06 CLI first-use: pass
OS-07 package/security surface: pass
OS-08 unsupported capability behavior: pass
```

The complete repository verification also passed: 115 tests, schema
reconciliation, 49 error references, package/secret/budget checks, clean-room
install, XLSX conformance, CLI smoke and five quickstart sessions. The package
also ships two rendered `.xlsx` demonstration workbooks; exported values and
formulas were read back and visually checked. Quickstart sessions remain
labelled `external: false`; these workbooks are not native Excel/Google Sheets
runtime evidence.

## Limits

This proves deterministic local/package behavior only. It does not prove
Google Sheets, Excel desktop, formula recalculation, production integration,
external users or a statistical engine. Any future adapter must add its own
capability, precondition, partial-failure, read-back and authorized live tests.

The next useful evidence is an external developer walkthrough and a
consented adapter integration, not another unsupported platform claim.
