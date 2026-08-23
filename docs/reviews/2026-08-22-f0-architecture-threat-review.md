# F1-010: F0 architecture and threat review

**Date:** 22 August 2026
**Subject:** OpenSheet-AI F0 foundation as it existed at review start
**Reviewer role:** independent architecture / threat pass against `AGENTS.md`, `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/IMPLEMENTATION_PLAN.md`, ADR 0001, landscape research, `src/`, `test/`, `schemas/`, `package.json`, `.github/workflows/ci.yml`, and `README.md`
**Churn:** no in-progress F1 edits were visible in `src/`, `test/`, or `schemas/` at review start. `dist/` is a local build artifact and is gitignored. This review is static; it does not treat a green local `npm run verify` as extra evidence beyond the tests that are actually written.

This is a review of current proof, not of the roadmap. SEM, Excel, Google Sheets, MCP, and grant metrics are correctly deferred and are not demanded here.

## 1. Verdict

F0 did the job it claimed at the product-boundary level: a private, in-memory, no-network plan/policy/receipt slice exists, and the docs mostly refuse to pretend it is a spreadsheet runtime.

The implementation does **not** yet make the central integrity claim true. The product story is that a validated plan has a canonical SHA-256 digest and that policy plus execution are bound to that plan. In the current code, JSON Schema is not executed, the runtime validator and the schema already disagree, `compilePlan` returns the caller’s live object, `executeInMemory` mutates a workbook clone from that live object, and `DEFAULT_POLICY` is a mutable export. Receipts therefore bind a digest of a moment, not a frozen artifact.

**F1 (contract hardening): GO.** The F0 spine is real enough to harden. F1-001, F1-002, F1-004, F1-006, F1-007, and F1-008 are the right next work. Do not start a real adapter until the digested snapshot is the only object policy and adapters may see.

**Public prerelease: NO-GO.** This still matches the project’s own gate in `docs/PRODUCT_SPEC.md` §13 and `docs/THREAT_MODEL.md` §9. The missing pieces are contract identity, fail-closed adapter receipts, public-package identity, and vulnerability reporting — not Excel, SEM, or adoption metrics.

## 2. What F0 actually proved

These hold in the current tree and are acceptable as F0 proof.

- Compilers in `src/modules/` do not call the network, read credentials, or use `Date` / `Math.random`. Plan identifiers are truncated SHA-256 slices of the intent, not wall-clock values.
- `write-range` and `write-formulas` are distinct operations. A string that starts with `=` is a legal literal in `write-range`. `write-formulas` requires an explicit `=` prefix. Default policy blocks `write-formulas`.
- `assertSheetPlan` runs before `evaluatePolicy`, and `executeInMemory` validates and evaluates policy before any `applyOperation` call.
- Dry-run clones first, keeps `afterDigest === beforeDigest`, and puts the prospective digest on `projectedAfterDigest`. Apply returns a different object from the caller-owned workbook. A blocked plan returns a clone with empty mutation and `status: "blocked"`.
- Range grammar is intentionally small: no sheet prefix, `$`, unions, or `A:A`. Excel row/column bounds are enforced in `parseA1Range`.
- There are zero production dependencies. `private: true` and `0.0.0-dev` are set. CI exists for Node 20 and 22, with `npm ci`, `npm run verify`, pinned actions, `contents: read`, and `npm audit --omit=dev`.
- README, spec, architecture, and threat model do not claim Excel, Google Sheets, SEM, MCP, ERP, payments, or adoption.

That is a foundation prototype. It is not yet a contract other people should implement against.

## 3. Threat controls T-001 .. T-018

Status is about **this tree**, not the roadmap column in `docs/THREAT_MODEL.md`.

| ID | Threat | Status in F0 code | Evidence |
| --- | --- | --- | --- |
| T-001 | Malformed range causes oversized / unintended write | **Implemented, unfuzzed** | `src/core/range.ts` rejects reversed and out-of-bounds ranges; `validateMatrix` checks rectangularity and range dimensions; policy `maxTouchedCells` default is 50_000. Tests cover `B2:A1`, `XFE1`, `A0`, and one dimension-mismatch case. No property/fuzz tests. No payload-size cap on CLI `JSON.parse`. |
| T-002 | Formula injection disguised as text | **Implemented, proof incomplete** | Validator keeps `write-range` values as `CellValue`. Memory adapter writes `{ kind: "value", value }`. No test writes `"=SUM(1)"` through `executeInMemory` and asserts `kind: "value"`. Conformance fixture class in architecture §12 is not in `test/`. |
| T-003 | Agent writes formulas without consent | **Implemented, default is mutable** | `DEFAULT_POLICY.allowFormulaWrites === false`; policy test exists; adapter blocked-path test exists. `DEFAULT_POLICY` is a plain exported object, not frozen. |
| T-004 | Plan touches unauthorized sheets | **Implemented as optional** | Exact-string `allowedSheets` check in `evaluatePolicy`. Test covers deny. Allowlist is not mandatory. Homoglyph / control-character sheet names are legal. |
| T-005 | Dry-run mutates workbook | **Implemented** | `test/memory.test.ts` freezes caller JSON and checks `afterDigest`. Default `dryRun` is `true`. |
| T-006 | Policy after partial mutation | **Happy path only** | Sequence in `executeInMemory` is validate → policy → clone → apply. If `requireSheet` throws, the function throws. No receipt. Caller-owned state is still intact because apply runs on a clone. |
| T-007 | Plan or receipt altered | **Docs overclaim relative to code** | `digestJson` exists and is deterministic for plain JSON. Execution does not round-trip through canonical bytes. Receipts are unsigned. There is no receipt validator and no tamper test. |
| T-008 | Receipt mistaken for authorization | **Docs-only, and that is the right F0 control** | Threat model §8 and architecture §3.6 state the boundary. README does not call receipts cryptographic authorization. Receipt schema has no signing fields. |
| T-009 | Time or randomness breaks replay | **Mostly implemented; one compiler leak** | Compilers use hashes, not clocks. Adapter clock is injected. `compileGapMap` sorts unexpected constructs with `localeCompare()` and therefore reads the environment. |
| T-010 | Unsupported operation silently ignored | **Closed at validation, not at adapter preflight** | Unknown `kind` and unknown `schemaVersion` fail in `assertSheetPlan`. Memory adapter has no capability manifest and no default branch at runtime. A valid v1 op against a missing sheet throws instead of failing closed with a receipt. |
| T-011 | Live adapter overwrites stale state | **Not in foundation** | Correctly absent. Do not add a real adapter until F1-004 preconditions exist. |
| T-012 | Credential leakage | **Implemented for core** | No `fetch`, `process.env`, or credential types in `src/`. CLI reads local JSON only. Remaining work is secret scanning and a real reporting address, not core code. |
| T-013 | Customer data in logs or receipts | **Partial** | `ExecutionReceipt` stores digests, counts, and finding strings. CLI `apply-memory` prints `{ workbook, receipt }`, so cell values go to stdout even on dry-run when a workbook path is supplied. Finding messages interpolate raw sheet names. |
| T-014 | Arbitrary script execution | **Implemented** | Closed operation union. No `eval` / `Function` / code fields. MCP is not present and must stay declarative if added. |
| T-015 | Dependency compromise | **Implemented for F0** | No production `dependencies`. Lockfile present. CI production audit is vacuously empty and still useful as a tripwire. No provenance, no pack-content golden file, no secret scan. |
| T-016 | Statistical result looks convincing | **Excluded** | Correct. Scale-bank example source text says demonstration items are not a validated instrument. |
| T-017 | Connector retry duplicates writes | **Excluded** | Correct. |
| T-018 | Payment triggered by sheet mutation | **Excluded** | Correct. |

Foundation controls that are actually code: T-001 (partial), T-002 (code, weak tests), T-003, T-004 (optional), T-005, T-006 (caller state only), T-009 (except gap-map sort), T-010 (validator only), T-012, T-014, T-015.

Foundation controls that are still documentation: T-007 signing/verification, T-008, T-011, T-016, T-017, T-018, and the adapter half of T-006 / T-010.

## 4. Findings

### Critical

None. F0 cannot yet destroy a real workbook, and the in-memory clone path does not mutate caller-owned state on the tested dry-run, apply, and blocked paths.

### High

#### R-001 — Digest and policy do not bind the object that executes

**Severity:** high
**Evidence:** `src/core/plan.ts` `compilePlan` returns `{ plan: input }` (same reference). `src/adapters/memory.ts` `executeInMemory` calls `compilePlan(plan)`, then `evaluatePolicy(plan, policy)`, then `plan.operations.forEach(applyOperation)`. `src/core/policy.ts` exports unfrozen `DEFAULT_POLICY`. `src/index.ts` re-exports both.

**Why it matters:** Product spec §5.5 and threat T-007 say the receipt binds the SHA-256 digest of the exact plan. That is only true for inert JSON values that nobody mutates. Getters, proxies, or a mutated `DEFAULT_POLICY.allowFormulaWrites = true` can make validation, digest, policy, and apply observe different facts. The default-deny formula control is then a convention, not an invariant.

**F1 fix:** Structured-clone (or canonicalize → `JSON.parse`) the plan at the validation boundary. Digest, evaluate policy, and execute only that snapshot. `Object.freeze` the default policy (and copy it before use). Add a tamper test that mutates the caller object after `compilePlan` and proves apply still matches the digest.

#### R-002 — JSON Schema is not a validator and already drifts from TypeScript

**Severity:** high
**Evidence:** `test/schema.test.ts` only checks that the files parse and that `$id` / `$schema` strings match. No Ajv (or other) runtime. Architecture §2 already admits this, then says the prototype “tests their identities.” Identities of `$id` strings are not identities of rules.

Concrete drift against `src/core/validation.ts` and `src/core/range.ts`:

| Rule | Runtime validator | `schemas/plan.v1.schema.json` |
| --- | --- | --- |
| Unique operation `id` | required | not expressed |
| Sheet characters `[]:*?/\\` | rejected | only length 1–100 |
| Reversed range `B2:A1` | rejected | pattern allows it |
| Excel bounds (`XFE1`, row `1048577`) | rejected | pattern allows it |
| Matrix shape vs range | required | not expressed |
| `number-between` `min <= max` | required | not expressed |
| Range whitespace `" A1 "` | accepted (`trim`) | rejected by `^...$` |
| Receipts | no runtime validator | schema exists and is unused |

**Why it matters:** FR-001 says the plan is TypeScript **and** JSON Schema. External adapter authors will pick one. A schema-only consumer will accept plans the official runtime rejects, and the opposite for trimmed ranges. That is how a “portable contract” forks before the first real adapter.

**F1 fix:** F1-001 as written. One shared JSON Schema validator in `verify`. Fixture pairs: every runtime rejection has a schema rejection, and every accepted example is schema-valid. Flatten `allOf` + `additionalProperties: false` or switch to `unevaluatedProperties` so the schema is not validator-specific folklore. Add `assertReceipt`.

#### R-003 — `gap-map` sorting inspects locale

**Severity:** high
**Evidence:** `src/modules/gap-map.ts` sorts unexpected constructs with `left.localeCompare(right)` and no locale argument. Construct codes are not restricted to ASCII. Architecture §3.1: a compiler “may not … inspect the environment.” NFR-003: no environment-dependent planner output. Tests use only `A` / `B` / `C` / `X`.

**Why it matters:** The same typed intent can emit different row orders, therefore different canonical bytes and different digests, on two machines. That breaks the F0 thesis on the second module.

**F1 fix:** Sort with code-unit comparison (`<` / `>`) or a pinned locale + options. Add a fixture with non-ASCII unexpected codes and lock the digest.

#### R-004 — Policy-pass can still throw with no receipt

**Severity:** high
**Evidence:** `requireSheet` in `src/adapters/memory.ts` throws `Error` if a write/format/freeze/width/validation targets a sheet that was not `ensure-sheet`’d and is not already in the workbook. `assertSheetPlan` does not require `ensure-sheet` before other ops. `executeInMemory` has no try/catch and no capability/precondition step. Architecture §3.4 item 3 and threat T-010 remaining work both require fail-before-mutation with explicit results. Tests always include `ensure-sheet`.

**Why it matters:** The receipt is the audit object. An exception is not a blocked receipt. Hosts that catch and continue will have mutated nothing (good) and recorded nothing (bad). A later Google/xlsx adapter that applies sequentially will turn this into partial writes unless F1 defines preflight.

**F1 fix:** F1-002 and F1-004. Preflight the whole plan: unknown ops, missing sheets, unsupported kinds. If any check fails, return `status: "blocked"` with findings and `afterDigest === beforeDigest`. Never throw from the adapter for a structurally valid plan.

#### R-005 — Foundation security fixtures are missing from `test/`

**Severity:** high
**Evidence:** Architecture §12 lists literal `=` preservation, blocked formulas, dry-run non-mutation, and fail-closed unsupported ops as conformance classes. Current tests:

- no `write-range` value `"=SUM(1)"` through the memory adapter;
- no unknown `kind` / unknown `schemaVersion` test (the code rejects them);
- no `allowSheetCreation: false` or `allowFormatting: false` test;
- no `operation_budget_exceeded` test;
- no example JSON compiled in `test/` (`examples/*.json` are not imported);
- no CLI test, despite F0-012 “preview/apply smoke” marked implemented and F0 exit “both example intents compile.”

`npm run verify` can stay green while examples, CLI, and T-002 adapter behavior rot.

**Why it matters:** This project’s only advantage over direct-write tools is that the contract is testable. If the tests do not encode the threat model, F1 will harden comments.

**F1 fix:** Add a `test/conformance/` (or equivalent) that compiles both examples, round-trips CLI compile/validate/apply-memory, preserves formula-like literals, and locks unknown-kind / unknown-version fail-closed behavior. Put those under `verify`.

### Medium

#### R-006 — Untrusted intents are not closed-world

**Severity:** medium
**Evidence:** `compileScaleBank` / `compileGapMap` validate some fields, then trust the TypeScript shape. CLI does `intent as ScaleBankIntent`. Extra keys are ignored in operations but included in `digestJson(intent)` used for `planId`. Missing `constructs` throws `Cannot read properties of undefined`. Threat model: typed intent is still untrusted.

**Why it matters:** LLM- or MCP-produced JSON will be extra-key-heavy and partially typed. Two semantically equal intents can hash to different `planId`s, and missing fields fail with non-stable errors (F1-008).

**F1 fix:** Intent schemas, extra-property rejection, and stable codes. CLI must validate before `as`.

#### R-007 — CLI treats workbook JSON as `MemoryWorkbook` and prints it

**Severity:** medium
**Evidence:** `src/cli.ts` `apply-memory` casts `readJson` to `MemoryWorkbook` with no schema. `print(executeInMemory(...))` always emits `{ workbook, receipt }`. README says `--apply` “return[s] the resulting in-memory workbook rather than a dry-run receipt.” T-013 says foundation receipts store digests and metadata only.

**Why it matters:** The receipt boundary is real in the type and fake at the CLI surface. Workbook contents, including any formula-like literals, go to stdout. Invalid workbook JSON fails inside `digestJson` / `applyOperation` instead of a blocked receipt.

**F1 fix:** Validate workbook snapshots (F1-003). Default CLI output is the receipt. Put workbook cells behind an explicit flag. Fix the README.

#### R-008 — Sheet dictionaries are prototype-bearing maps keyed by untrusted names

**Severity:** medium
**Evidence:** `createEmptyWorkbook` uses `{ id, sheets: {} }`. Sheet names from plans are not matched against `__proto__` / `constructor`. `validateSheetName` allows newlines and other control characters. Policy messages interpolate `operation.sheet`. Threat model §7 lists confusables and log-control characters as abuse cases before live adapters.

**Why it matters:** `__proto__` as a sheet name does not populate a real sheet (`??=` sees a truthy prototype) and then `requireSheet` returns `Object.prototype` and throws on `.cells`. That is a crash, not a receipt. Control characters in findings/CLI output are a log-injection path once this is hosted.

**F1 fix:** `Object.create(null)` or `Map` for sheet and cell dictionaries. Reject control characters and reserved names at validation. Mandatory allowlists stay an F2 live-adapter requirement.

#### R-009 — Public export surface is already the memory adapter

**Severity:** medium
**Evidence:** `src/index.ts` exports `executeInMemory`, `MemoryWorkbook`, `MemorySheet`, `MemoryCell`. Architecture §6 says this function is not the final public adapter interface. `package.json` `exports` is only `"."`. `files` ships `dist` + `schemas` + README + LICENSE, not examples or architecture.

**Why it matters:** F1 is supposed to introduce capability/preflight/snapshot contracts. If anything consumes `0.0.0-dev` from a copied `dist/`, those memory types become compatibility drag. Adapter authors also cannot see the spec from the pack.

**F1 fix:** Mark memory execution experimental or move it behind `opensheet-ai/memory`. Freeze a tiny public surface: plan types, `assertSheetPlan`, `compilePlan`, `evaluatePolicy`, digest helpers, module compilers. Define the adapter interface before F2.

#### R-010 — Canonicalization is an unofficial dialect

**Severity:** medium
**Evidence:** `src/core/canonical.ts` is a custom key-sorted JSON serializer, not RFC 8785, and not specified outside the TypeScript file. `digestJson` prefixes `sha256:`. Receipt schema requires that pattern. No cross-language fixture.

**Why it matters:** The digest is the integrity identifier. A second implementation that uses JCS or `JSON.stringify` will not match. F1-006 cannot do receipt verification without a frozen algorithm.

**F1 fix:** Specify canonicalization in `docs/` with byte-level fixtures, or adopt RFC 8785 and test it. Include `undefined`, `-0`, nested key order, and non-finite rejection.

#### R-011 — Plan `target.workbook` is never bound to adapter state

**Severity:** medium
**Evidence:** `executeInMemory` digests whatever object it is given. It does not compare `plan.target.workbook` to `workbook.id`. CLI only uses the plan target when it creates an empty workbook.

**Why it matters:** The envelope looks like an authorization scope and is currently a string field. That will mislead the first real adapter.

**F1 fix:** Precondition: snapshot identity must match `target.workbook` unless an explicit override is present. Mismatch → blocked receipt.

#### R-012 — Supply chain for a public package is not in `verify`

**Severity:** medium
**Evidence:** `check:pack` runs `npm pack --dry-run` with no content assertion. CI has no secret scan. `LICENSE` is Apache-2.0 terms with no copyright holder and no appendix. `package.json` has no `repository`, `bugs`, `author`, or `homepage`. `.github/SECURITY.md` tells reporters to use “an established private channel” and has no address. Schema `$id` hosts `https://opensheet-ai.dev/...`; landscape research only checked npm/GitHub name 404s, not domain ownership.

**Why it matters:** Threat T-015 remaining work and threat-model §9 are explicit: pack scan, secret scan, private vulnerability reporting, public CI artifacts. Publishing this tree would ship an ownerless Apache work, an uncontactable security policy, and a schema id on an unverified domain.

**F1/F3 fix:** Golden `npm pack --dry-run` file list. Secret scan in CI. Copyright line. Real security contact. Do not publish `$id` URLs for a domain the owner does not control. Keep `private: true` until that is done.

#### R-013 — Column-width names skip Excel bounds

**Severity:** medium
**Evidence:** `set-column-widths` accepts `^[A-Z]{1,3}$`, including `XFE` / `ZZZ`. `parseA1Range` would reject those as ranges. Gap-map observed columns use the same loose column regex.

**Why it matters:** The range contract pretends to be Excel-bounded. Widths and gap-map columns are not. A later adapter will fail or truncate silently unless this is closed in v1.

**F1 fix:** Parse widths through the same column mapper that enforces `1..16384`.

### Low

#### R-014 — README / CLI help disagree with CLI behavior

**Severity:** low
**Evidence:** README and `help()` say `--apply` returns the workbook rather than a dry-run receipt. Code always prints `{ workbook, receipt }`; `--apply` only flips `dryRun`.

**F1 fix:** Document the actual JSON shape. Prefer receipt-first output (see R-007).

#### R-015 — `engines` is wider than the tested runtime

**Severity:** low
**Evidence:** NFR-001 and CI: Node 20 and 22. `package.json` `"node": ">=20"` admits 23+.

**F1 fix:** `"node": ">=20 <23"` or an explicit 20/22 statement in README until more versions are in CI.

#### R-016 — Intent validation is inconsistent across modules

**Severity:** low
**Evidence:** Scale-bank caps many strings at 500 characters and requires integer `min < max`. Gap-map only checks non-blank and `minimumItems >= 1`. Illegal `sheetName` characters fail later inside `compilePlan`, not in intent validation.

**F1 fix:** Shared intent helpers and stable error codes (F1-008).

#### R-017 — `MemorySheet.frozen` is a mutable field on an otherwise “readonly” type

**Severity:** low
**Evidence:** `src/adapters/memory.ts` marks `cells` / `validations` / `formats` / `columnWidths` `readonly` but leaves `frozen` assignable. Deep clone is `JSON.parse(JSON.stringify)`.

**F1 fix:** Make the snapshot type readonly end-to-end; do not call it immutable unless `Object.freeze` is actually used.

#### R-018 — Policy does not gate data-validation writes

**Severity:** low
**Evidence:** Architecture table lists `set-data-validation` as allowed. Policy has `allowFormatting` for `set-format` only. List rules may contain strings beginning with `=`.

**F2 fix:** When an xlsx/Sheets adapter exists, decide whether list items are literals. If yes, test it. If not, add a policy bit.

### Notes (not defects)

- **N-001:** ADR 0001 and the landscape memo are the right product cut. Do not widen F1 into MCP, SEM, or connectors.
- **N-002:** `private: true`, `0.0.0-dev`, and the README name-availability caveat are honest. No adoption, download, or OpenSSF-criticality claims were found in README or package metadata.
- **N-003:** CI hygiene is better than typical F0: action SHAs, `persist-credentials: false`, `contents: read`, Dependabot for npm and actions.
- **N-004:** FR-008 disclaimer exists in `examples/scale-bank.json` source fields. The compiler does not inject a sheet-level warning; that is acceptable for F0 example content.
- **N-005:** Unsigned receipts are correctly described as non-authorization. Do not add signing theatre in F1; add verification of the canonical payload first (F1-006).
- **N-006:** Optional sheet allowlists are acceptable for in-memory F0. They must be mandatory for any live adapter (T-004 remaining work). That is F2, not F1.

## 5. Already acceptable for F0 vs must fix before public prerelease

**Acceptable to leave in F0 (do not block starting F1):**

- in-memory adapter only; no capability manifest yet;
- unsigned receipts;
- optional sheet allowlist;
- no fuzz harness yet (F1-007);
- no JSON Schema runtime validator yet, *provided F1-001 is the first hardening item*;
- no secret scan yet while the repo is private;
- no issue templates, support SLA, or grant ledger;
- no Excel / Sheets / MCP / SEM.

**Must fix before public prerelease** (project spec §13 + threat model §9, plus this review):

- R-001 snapshot-bound execute path and frozen defaults;
- R-002 shared schema/runtime validator and receipt validator;
- R-003 locale-free compilers;
- R-004 fail-closed adapter receipts / preflight;
- R-005 example, CLI, and T-002 conformance tests under `verify`;
- R-006 closed-world intents;
- R-007 receipt-first CLI;
- R-009 explicit public surface and adapter interface;
- R-010 specified canonicalization fixtures;
- R-012 copyright, security contact, pack golden file, secret scan, honest `$id`;
- capability contract and at least one real read/write adapter (already in the spec; this review does not choose xlsx vs Google);
- owner authorization to publish.

F1 should absorb the contract items. F2 absorbs the real adapter. F3 publishes.

## 6. Go / no-go

| Gate | Decision | Condition |
| --- | --- | --- |
| Start F1 contract hardening | **GO** | Treat R-001..R-005 as F1 entrance bugs, not as later polish. Do not implement xlsx/Sheets/MCP in the same pass. |
| Public prerelease | **NO-GO** | Contract identity, fail-closed receipts, pack/security identity, and the spec’s own “real adapter + clean-room install” gate are all open. Shipping `0.0.0-dev` as a public package would freeze a moving IR and over-claim portability. |

## 7. Counts and the one fix

**Findings by severity:** critical 0, high 5, medium 8, low 5, notes 6.

**Single most important fix:** Make the canonical validated plan bytes the only input to digest, policy, and adapters (R-001 + R-002). Until that is true, OpenSheet-AI is a well-documented in-memory script with a hash field, not a portable integrity contract.
