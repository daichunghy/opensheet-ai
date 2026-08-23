# F2 first-adapter choice

**Research date:** 22 August 2026

**Decision supported:** choose the first real adapter after F0 (in-memory only). F2 is `.xlsx` or Google Sheets, not both at once.
**Confidence:** high that Google Sheets `batchUpdate` is atomic and lacks a first-class revision precondition; high that npm `xlsx@0.18.5` is a security non-starter; moderate that `.xlsx` is the correct first adapter given zero verified external demand; low that any Node `.xlsx` library preserves arbitrary existing workbooks without independent fixtures.

## 1. Bottom line

Build a credential-free `.xlsx` adapter first. Do not start a Google Sheets adapter in F2.

OpenSheet-AI still has no verified external demand. Adjacent MCP/SDK projects already cover direct Excel and Google Sheets tool use, dry-run, and (in one case) atomic Sheets writes. None of them expose a portable, provider-neutral, closed operation union with policy and receipts that OpenSheet could implement against instead of owning. That does not prove the gap is wanted. It only means F2 should prove the existing v1 contract against a file that CI can read back without credentials.

Google Sheets remains a plausible later adapter: `spreadsheets.batchUpdate` can map all seven v1 operations, and Google documents atomic apply-or-none behavior. It is the worse first proof because it requires host credentials, has no `writeControl`/`requiredRevisionId` on the Sheets `batchUpdate` body (unlike Docs/Slides/Forms), and cannot be a reproducible CI gate.

Library choice inside the `.xlsx` adapter is a separate fail-closed decision: use a write-to-new-file path; refuse overwrite and unsupported round-trip features rather than silently dropping them.

## 2. What changed since the landscape note

The 22 August landscape sample still holds. Recheck on the same day, against live repositories and npm, adds:

| Project | Live state on 22 Aug 2026 | Portable plan contract? | Implication |
| --- | --- | --- | --- |
| [PSU3D0/spreadsheet-mcp](https://github.com/PSU3D0/spreadsheet-mcp) (`spreadsheet-kit`) | GitHub release [v0.11.1](https://github.com/PSU3D0/spreadsheet-mcp/releases/tag/v0.11.1) (20 Jul 2026). npm `agent-spreadsheet` is **0.10.1** (13 Feb 2026). README-advertised `spreadsheet-kit-sdk` is **not on npm** (`npm view` 404). | No. CLI/MCP ops, session events, SheetPort manifests, and `transformBatch` are Excel-file tool surfaces. The SDK’s “backend-agnostic” claim is MCP vs WASM for **Excel workbooks**, not Excel vs Google Sheets. | Strongest adjacent Excel agent stack. Do not reimplement its tool catalogue. Do not treat unpublished SDK copy as an implementable IR. |
| [@iota-uz/sheets-mcp](https://github.com/iota-uz/sheets-mcp) | npm **0.2.0** (2 Jun 2026), Apache-2.0. Compiles agent JS in a `vm` to one atomic `batchUpdate`. Dry-run is explicitly a **JS-only preview**: requests are never sent, Google does not validate them, and the README states there is no `validateOnly`. Idempotency is `DeveloperMetadata` on inserts. | No. The contract is Google-specific JS + Sheets v4 `Request[]`. | Closest mapping of v1 ops onto Sheets, but the IR is executable JS, which OpenSheet’s core forbids. |
| [iHeldan/sheetforge-mcp](https://github.com/iHeldan/sheetforge-mcp) | GitHub **v0.8.0** (20 Apr 2026). Python/`openpyxl`, 76 MCP tools, local `.xlsx`, `dry_run`, structure/content tokens. Not on npm (PyPI/`uvx`). | No. Tool catalogue plus file tokens, not a closed portable union. | Local Excel MCP already exists. Competing on tool count is out of scope. |
| [Univer](https://github.com/dream-num/univer) | Apache-2.0 OSS SDK; Univer Pro is commercial. Formula engine + Facade API, browser and Node. | No for OpenSheet v1. Command/plugin model is a full office runtime. | Do not build a grid or formula engine. Possible later runtime adapter, not F2. |
| [HyperFormula](https://hyperformula.handsontable.com/) | npm **3.4.0** (10 Aug 2026), **GPL-3.0-only** or proprietary. | Calculation engine only. | License boundary: do not take as a core dependency. Recalc is an F2 non-goal. |
| [IronCalc](https://github.com/ironcalc/IronCalc) | MIT **and** Apache-2.0. Rust engine plus `xlsx` reader/writer. Still evolving toward 1.0. | Engine API, not a plan IR. | Future calculation/runtime adapter candidate. Not a first CI adapter. |

**Not verified:** whether spreadsheet-kit maintainers would accept a small closed plan/receipt schema as a contribution; whether `spreadsheet-kit-sdk` has unpublished `sdk-v*` tags; PyPI version metadata for SheetForge beyond the GitHub README claim of `0.8.0`.

### What would make a competing plan protocol redundant

A shared IR would be redundant if an adjacent project already shipped all of:

1. a **closed**, versioned, non-executable operation union;
2. the same union across **more than one spreadsheet provider**;
3. policy evaluation before mutation;
4. dry-run that does not mutate caller-owned state;
5. a receipt binding plan digest to before/after workbook state.

None of the rechecked projects do that.

| Layer they already have | spreadsheet-kit | sheets-mcp | SheetForge | OpenSheet v1 |
| --- | --- | --- | --- | --- |
| Direct workbook tools | yes (large CLI/MCP) | yes (JS API) | yes (76 tools) | no (seven ops) |
| Dry-run | yes (file/session) | JS-only preview; Google does not validate | yes (`dry_run`) | yes (in-memory) |
| Atomic apply | file write / session apply | Google `batchUpdate` | file write | in-memory clone |
| Provider-neutral plan | no (Excel files) | no (Sheets only) | no (`.xlsx` only) | yes (contract only) |
| Policy engine | no (safety is CLI flags / dry-run) | no | no | yes |
| Receipt + plan digest | verify/diff/proof, not `opensheet.receipt.v1` | insert metadata tokens | structure/content tokens | yes |
| Executable agent code in the trust boundary | no | **yes** (`vm`) | no | **forbidden** |

spreadsheet-kit’s `write batch *` JSON and session `ops` are the closest operation contract. They are Excel-centric, include destructive/structural kinds that OpenSheet v1 excludes, and are not a Google Sheets mapping. Implementing OpenSheet as “yet another `transformBatch` consumer” would drop the portable plan, policy, and receipt claims.

sheets-mcp already does the interesting Sheets part (typed ops → one `batchUpdate`). Replacing that with OpenSheet would only be justified if callers wanted a **non-JS**, policy-gated, cross-adapter plan. No such caller is recorded.

## 3. `.xlsx` library evidence

Goal of this matrix: a **credential-free CI adapter** that can apply the seven v1 operations, write a new file by default, read it back, and **fail closed** on unsupported features. OpenSheet NFR-001 requires Node 20 and 22.

Live npm/GitHub check on 22 August 2026:

| | ExcelJS | SheetJS Community | Third option: ExcelForge |
| --- | --- | --- | --- |
| Package | `exceljs@4.4.0` | npm `xlsx@0.18.5` (stale). Authoritative CE is **0.20.3** via [cdn.sheetjs.com](https://cdn.sheetjs.com/) (`xlsx-0.20.3.tgz`). Unofficial npm republish `@e965/xlsx@0.20.3` (19 Jul 2024). | `@node-projects/excelforge@3.8.0` (13 Aug 2026) |
| License | MIT | Apache-2.0 (CE). Styling, validation, charts, pivots, formula eval are **Pro** features. | MIT |
| Last stable release | 19 Oct 2023. `4.4.1-prerelease.0` on 20 Dec 2024. Default-branch commits observed through Jan 2024. Snyk marks maintenance **inactive**. | npm 0.18.5: 24 Mar 2022. CE 0.20.3 browser tests dated 12 Jan 2026 on docs.sheetjs.com. Docs pages last updated 3 Aug 2026. | 3.8.0 on 13 Aug 2026. Versions 3.1–3.8 present on npm. |
| Unpacked size | 21.8 MB | npm 0.18.5: 7.5 MB. `@e965/xlsx`: 8.1 MB. | 1.9 MB |
| Runtime deps | `archiver`, `jszip`, `unzipper`, `tmp`, `uuid`, `saxes`, `fast-csv`, `dayjs`, `readable-stream` | none material for CE parser/writer | **none** (README claim; `npm view` dependencies `null`) |
| Node 20/22 | `engines: node >=8.3.0`. CI historically added Node 20. **Not verified** on Node 22 as of this check. | `engines: node >=0.8`. | no `engines` field. README lists Node/Deno/Bun/edge. **Not verified** on 20/22 in this repo. |
| Formula preservation | Writes `{ formula, result }`. Does **not** evaluate. English function names, comma separators. | CE reads/writes formula strings. Eval and styling are Pro. | `setFormula` / array formulas documented. Engine is optional and out of F2 scope. |
| Data validation | First-class `dataValidation` (`list`, `decimal`/`between`, `allowBlank`). Independent 24 Mar 2026 round-trip test reported **duplicated rules** and **broken cross-sheet dropdowns** on existing workbooks ([mfyz](https://mfyz.com/nodejs-excel-library-comparison/)). | CE: **lost** on write in that test. Pro territory. | README: list / whole / decimal / date / time / text length / custom formula. Round-trip quality **not verified** here. |
| Formatting (v1: bold, fill, wrap, h-align) | Yes (font/fill/alignment). | CE: data-focused; styling is Pro. Community write commonly strips style. | Yes (fluent style API). |
| Tables | `addTable` exists. Loaded-table mutation has known bugs; community fork discussion [exceljs#2987](https://github.com/exceljs/exceljs/discussions/2987). v1 has **no table op**, but round-trip of input tables is a preservation hazard. | CE does not own table/style round-trip. | README: tables plus “patch-only writes” that re-serialize dirty sheets and preserve unknown parts. **Not verified.** |
| Freeze pane | `worksheet.views = [{ state: 'frozen', ySplit, xSplit }]`. | Not a CE feature. | `ws.freeze(rows, cols)`. |
| File size / streaming | Streaming reader/writer exists; in-memory path is heavy. | Generally smaller writes; one test saw **+375 KB** bloat vs input. | Claims DEFLATE 0–9; default 6. **Not verified.** |
| Security | Snyk: no **direct** CVE on 4.4.0. Open issues in 2026 for transitive `tmp` (CVE-2026-44705 / GHSA-ph9p-34f9-6g65), `uuid` (GHSA-w5hq-g745-h8pq), `inflight`, `brace-expansion`. Maintainer inactivity means those stay until a fork or override. | npm `xlsx@0.18.5` is affected by **CVE-2023-30533** (prototype pollution, fixed CE 0.19.3) and **CVE-2024-22363 / GHSA-5pgg-2g8v-p4x9** (ReDoS, fixed CE 0.20.2). GitHub advisory lists **no patched npm version**. | No first-party advisory review done here. Zero-dep surface is attractive; **not audited**. |

`xlsx-populate@1.21.0` (MIT) preserved validations in the March 2026 independent test, but the last **version publish** is **1 Mar 2020**. Registry `time.modified` of 9 Sep 2025 is not a new release. It is not a maintained option.

`devextreme-exceljs-fork@4.4.13` (7 Aug 2026, MIT) is maintained, but `engines.node` is **`>=22.21.1`**, which fails OpenSheet’s Node 20 line. Out for F2.

### Fail-closed rules for any `.xlsx` library

These are adapter requirements, not library marketing:

1. **Write a new file by default.** Refuse overwrite unless an explicit option and a precondition digest are supplied (already in F2 candidate A).
2. **Do not claim round-trip of arbitrary workbooks.** If the input contains charts, drawings, pivots, VBA, or existing data-validation collections the library cannot prove it preserves, **block** with a stable unsupported code before mutation.
3. **Do not evaluate formulas.** Store the formula text. Recalc is out of v1.
4. **Keep literals and formulas separate.** A `write-range` value that looks like `=SUM(A1)` remains a string, matching the in-memory adapter.
5. **Pin and vendor the chosen tarball.** Do not depend on npm `xlsx@0.18.5`. If SheetJS CE is ever used, install from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (or a later CE that still contains the ReDoS/prototype-pollution fixes) and record the SHA.
6. **Node 20 and 22 fixtures are acceptance evidence**, not a README claim.

**Provisional library pick (not an implementation):** ExcelJS remains the only widely used Node library whose **documented** API covers all seven v1 operations without a commercial license. It is also inactive, large, and unsafe to use as a silent round-trip editor. Acceptable for F2 only on a **green-field write** plus fail-closed input scan.

ExcelForge is the maintained alternative to evaluate with the same conformance fixtures. It is not the default until those fixtures exist. Switching libraries later should not change `opensheet.plan.v1`.

## 4. Google Sheets `spreadsheets.batchUpdate`

Sources: [batchUpdate guide](https://developers.google.com/workspace/sheets/api/guides/batchupdate) (updated 22 Jul 2026), [method reference](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate) (23 Jul 2026), [usage limits](https://developers.google.com/workspace/sheets/api/limits) (31 Jul 2026).

### Atomicity

Google documents that every request is validated before apply, and if any request is invalid the entire batch fails and nothing is applied. Limits page: “All Sheets requests are applied atomically.”

The same method reference immediately weakens post-conditions: because spreadsheets are collaborative, “it is not guaranteed that the spreadsheet will reflect exactly your changes after this completes,” only that the batch’s updates are applied together. With no collaborators, it “should” reflect the changes.

There is **no platform dry-run / `validateOnly`**. sheets-mcp’s 0.2.0 README states this as a production finding.

### Size, time, quota

| Constraint | Documented behavior | Adapter implication |
| --- | --- | --- |
| Payload | No hard request size. **2 MB recommended** to avoid unspecified processing limits. | Capability budget must cap serialized batch size, not only OpenSheet cell counts. |
| Time | Processing > **180 seconds** returns timeout. Timeout after partial apply is **not specified**. Treat as ambiguous; do not retry blindly. | F1 errors need an `ambiguous-result` code. |
| Quota | Per-minute refill. Body text cites **300 read requests / minute / project**. Write table cells did not render numeric values in the fetched HTML. Batch counts as **one** API request. Daily cap: none while inside per-minute quotas. | Record live quota numbers from Cloud Console at adapter implementation time. **Not verified** for write/user splits on this fetch. |
| Pricing | Standard use currently no extra charge. Exceeding quota is **planned to incur charges later in 2026** ([Workspace agent tools model](https://developers.google.com/workspace/tools-safety)). | Host, not core, owns billing. |
| Auth | `drive`, `drive.file`, or `spreadsheets` scope. | Credentials stay in the host. Core never stores them. |

### Revision / precondition support

Sheets `batchUpdate` request body fields are: `requests`, `includeSpreadsheetInResponse`, `responseRanges`, `responseIncludeGridData`, `commentsViewMode`.

There is **no `writeControl`**, **no `requiredRevisionId`**, and **no `If-Match`** on this method. Docs, Slides, and Forms `batchUpdate` **do** have `WriteControl.requiredRevisionId`. That difference is load-bearing for F1-004: OpenSheet cannot assume a platform revision token on Sheets.

Workarounds that are **not** equivalent to a revision precondition:

- Drive Revisions API (separate resource; not transactional with the Sheets batch);
- `DeveloperMetadata` idempotency keys (sheets-mcp insert path only);
- OpenSheet snapshot digest from `spreadsheets.get`, compared in-process before send;
- `includeSpreadsheetInResponse` / follow-up `get` for read-back.

Collaborator writes can still land beside an applied batch. Receipts must not claim exclusive ownership of cloud state.

### v1 operation mapping

OpenSheet v1 kinds from `src/core/types.ts`:

| OpenSheet v1 | Sheets mapping | Notes / fail-closed |
| --- | --- | --- |
| `ensure-sheet` | Pre-read sheet list via `spreadsheets.get`. If missing, `addSheet` with `properties.title`. | **Not expressible as a single blind batch.** Duplicate title fails the whole batch. Idempotent ensure requires a snapshot. `addSheet` returns `sheetId` needed by later grid requests. |
| `write-range` | `updateCells` with `userEnteredValue.{stringValue,numberValue,boolValue}` and fields `userEnteredValue`. Empty/null cells need an explicit null/unset policy. | Do **not** use `values.batchUpdate` with `USER_ENTERED` (would coerce `=...` strings into formulas). Literal strings that start with `=` stay literals. |
| `write-formulas` | `updateCells` with `userEnteredValue.formulaValue`. Do not use `repeatCell` (it auto-increments relative refs across the range). | Formula dialect is Sheets, not Excel. Cross-adapter formula identity is **not** claimed. Default policy already blocks this op. |
| `set-data-validation` | `setDataValidation` + `DataValidationRule.condition`. `list` → `ONE_OF_LIST` (formulas not supported in list values). `number-between` → `NUMBER_BETWEEN` (two condition values). `allowBlank` has no dedicated field; **not verified** whether blank is allowed by default or needs a condition tweak. | Typed native Tables reject raw `setDataValidation` (sheets-mcp production note). v1 has no table op; if the target range is a Table, fail closed. |
| `set-format` | `repeatCell` / `updateCells` `userEnteredFormat`: `textFormat.bold`, `backgroundColorStyle`, `wrapStrategy=WRAP`, `horizontalAlignment`. | v1 format subset only. Do not send wildcard `fields: '*'` (resets unspecified properties). Color space (RGB vs theme) must be normalized in the snapshot. |
| `freeze-pane` | `updateSheetProperties` `gridProperties.{frozenRowCount,frozenColumnCount}` with field mask. | Maps directly to v1 `rows` / `columns` counts. |
| `set-column-widths` | `updateDimensionProperties` `pixelSize` on a `COLUMNS` `DimensionRange`. | v1 `width` is **not specified as pixels vs Excel character units**. Cross-adapter numeric equality is false unless F1 defines a unit. Fail closed or document as adapter-local. |

`sheetId` vs title: almost every mutation request uses numeric `sheetId`. The adapter must resolve names from the snapshot. Title rename by a collaborator between get and batch is an OCC miss, not a successful apply.

## 5. First-adapter recommendation

| Goal | Better first adapter | Evidence | Decision |
| --- | --- | --- | --- |
| Credential-free local conformance + reproducible CI | `.xlsx` | F0 already runs without network. IMPLEMENTATION_PLAN §4 says this explicitly. Node 20/22 CI can write, read back, and hash files. | **Choose this.** |
| Immediate MCP/agent integration demand | Google Sheets | sheets-mcp and many Sheets MCP servers already occupy this. OpenSheet has **no verified external demand** for a Sheets adapter or an MCP server (PRODUCT_SPEC §8: MCP is a foundation non-goal). | **Do not choose this in F2.** |

No contrary evidence was found that would override IMPLEMENTATION_PLAN. In particular:

- No recorded maintainer or user asking OpenSheet to speak Google first.
- spreadsheet-kit already is the Excel MCP/CLI; a file adapter still has unique value as a **conformance target for the plan contract**, not as another agent tool server.
- Google’s missing revision precondition makes F1 OCC work harder, not easier, as a first proof.

F3 may add an optional MCP **after** the plan/policy/receipt core is adapter-tested. That MCP should accept typed intents or plans, not arbitrary scripts (IMPLEMENTATION_PLAN F3-004).

## 6. F1 work this choice forces

Do F1 before writing adapter I/O. The following F1 packages are load-bearing for `.xlsx` first:

| F1 id | Why it gates F2 `.xlsx` |
| --- | --- |
| F1-002 capability + preflight | Encode library limits: no recalc, no chart/pivot/VBA preservation, validation round-trip unsafe on ExcelJS, column-width unit, format subset. Unsupported ops fail before mutation. |
| F1-003 snapshot + semantic diff | Cross-adapter comparison is normalized semantics, not xlsx bytes (ARCHITECTURE §12). Need this before claiming read-back. |
| F1-004 preconditions | File digest / sheet-existence / range-state. Do **not** design this around Sheets `requiredRevisionId`; it does not exist. |
| F1-005 idempotency | `ensure-sheet` and repeated apply on a new output path vs in-place. |
| F1-008 stable error codes | `unsupported-feature`, `precondition-mismatch`, `ambiguous-result` (Sheets timeout later). |

A Google adapter later should reuse the same capability/preflight schemas, not a second operation vocabulary.

## 7. Disconfirming tests: when to stop owning the plan

Continue OpenSheet independently only while the portable plan/policy/receipt is the product. Contribute instead, or stop expanding, when any of the following is true.

**Contribute the plan contract to spreadsheet-kit when:**

- maintainers want a closed, versioned, non-executable op union and a receipt schema **and** will version it independently of the 76-tool/CLI surface;
- the first real users are Excel-only and already run `asp` / `spreadsheet-mcp`;
- OpenSheet’s value collapses to “JSON ops Excel already has,” and policy/receipts can live as a spreadsheet-kit crate/package;
- `spreadsheet-kit-sdk` actually publishes and its `transformBatch` becomes the ecosystem IR.

That is better than a separate repo if those users will never execute the same plan on Google Sheets or another adapter.

**Contribute to sheets-mcp when:**

- demand is Google-only;
- they will accept a JSON plan IR **instead of** (or in front of) agent JS, with policy evaluated outside the `vm`;
- OpenSheet would otherwise re-implement A1 math and `Request[]` builders that already exist in `mcp/a1.mjs` and `mcp/requests.mjs`.

Do **not** contribute a plan IR there if the trust boundary still requires executing model-authored JavaScript.

**Abandon or freeze independent OpenSheet when:**

- five external users want direct workbook access and do not value plan portability or receipts (IMPLEMENTATION_PLAN §12);
- adapter differences make the seven-op model misleading (formula dialect, width units, validation blank handling);
- a mature project ships the same portable contract with better governance.

None of those conditions are met today. They are also not met in the opposite direction: there is no evidence yet that the world wants OpenSheet’s contract. F2 `.xlsx` is how that hypothesis is tested cheaply.

## 8. Confidence and gaps

**High:** Sheets `batchUpdate` atomicity language; absence of Sheets `writeControl`; npm `xlsx@0.18.5` advisories; ExcelJS 4.4.0 inactivity and documented v1-relevant APIs; no verified OpenSheet external demand; `spreadsheet-kit-sdk` not on npm as of this check.

**Moderate:** ExcelJS is an acceptable green-field writer for the seven ops; column-width and `allowBlank` mappings will need fixture proof; spreadsheet-kit remains Excel-only despite “backend-agnostic” wording.

**Low / not verified:**

- ExcelForge actual preservation of validations, freeze, and unknown parts under OpenSheet fixtures;
- ExcelJS on Node 22;
- exact Sheets write-quota numbers (table values did not render);
- timeout semantics if Google dies mid-batch;
- whether `allowBlank` can be mapped without a hidden Sheets default;
- maintainer appetite at spreadsheet-kit or sheets-mcp for a shared plan schema (no outreach in this task);
- PyPI/SheetForge installability beyond GitHub README;
- IronCalc xlsx writer fidelity as an F2 alternative (ruled out on product grounds: it is an engine, and F2 is one adapter, not a calc runtime).

The next evidence that would flip F2 to Google Sheets is a named external consumer who needs live Sheets execution and will not accept a file adapter. The next evidence that would stop independent F2 is a written offer from spreadsheet-kit or sheets-mcp to host the closed plan/receipt schema.

## 9. Sources

Checked 22 August 2026 unless a page date is given.

- OpenSheet: `docs/research/2026-08-22-landscape.md`, `docs/IMPLEMENTATION_PLAN.md` §4, `docs/PRODUCT_SPEC.md` §§8–11, 14–15, `docs/ARCHITECTURE.md` §§6, 12, `src/core/types.ts`
- [PSU3D0/spreadsheet-mcp README](https://github.com/PSU3D0/spreadsheet-mcp), [v0.11.1](https://github.com/PSU3D0/spreadsheet-mcp/releases/tag/v0.11.1), in-repo [spreadsheet-kit-sdk README](https://github.com/PSU3D0/spreadsheet-mcp/blob/main/npm/spreadsheet-kit-sdk/README.md); `npm view agent-spreadsheet` → 0.10.1; `npm view spreadsheet-kit-sdk` → 404
- [iota-uz/sheets-mcp README](https://github.com/iota-uz/sheets-mcp); `npm view @iota-uz/sheets-mcp` → 0.2.0, 2 Jun 2026
- [iHeldan/sheetforge-mcp README](https://github.com/iHeldan/sheetforge-mcp) / [v0.8.0](https://github.com/iHeldan/sheetforge-mcp/releases/tag/v0.8.0)
- [dream-num/univer](https://github.com/dream-num/univer) (Apache-2.0)
- [HyperFormula 3.4.0](https://hyperformula.handsontable.com/docs/) (GPL-3.0-only, 10 Aug 2026)
- [ironcalc/IronCalc](https://github.com/ironcalc/IronCalc) (`LICENSE-MIT`, `LICENSE-Apache-2.0`)
- [Google Sheets batchUpdate guide](https://developers.google.com/workspace/sheets/api/guides/batchupdate) (22 Jul 2026)
- [spreadsheets.batchUpdate reference](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate) (23 Jul 2026)
- [Sheets usage limits](https://developers.google.com/workspace/sheets/api/limits) (31 Jul 2026)
- [GridProperties](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/sheets) / [formatting sample (frozenRowCount)](https://developers.google.com/workspace/sheets/api/samples/formatting)
- [DataValidationRule / CellFormat](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/cells) (16 Jun 2026)
- [BooleanCondition ONE_OF_LIST](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/other)
- Docs/Slides `WriteControl` contrast: [Docs batchUpdate](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/batchUpdate), [Slides batchUpdate](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/batchUpdate)
- npm: `exceljs@4.4.0`, `xlsx@0.18.5`, `xlsx-populate@1.21.0`, `@node-projects/excelforge@3.8.0`, `devextreme-exceljs-fork@4.4.13`, `@e965/xlsx@0.20.3`
- [SheetJS CE docs](https://docs.sheetjs.com/docs/) (0.20.3; pages updated 3 Aug 2026); [cdn.sheetjs.com](https://cdn.sheetjs.com/)
- [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) / [CVE-2024-22363](https://cdn.sheetjs.com/advisories/CVE-2024-22363); [CVE-2023-30533](https://advisories.gitlab.com/npm/xlsx/CVE-2023-30533/)
- [Snyk exceljs](https://security.snyk.io/package/npm/exceljs); GitHub [exceljs#3053](https://github.com/exceljs/exceljs/issues/3053), [#3055](https://github.com/exceljs/exceljs/issues/3055), [#3041](https://github.com/exceljs/exceljs/issues/3041), [#2987](https://github.com/exceljs/exceljs/discussions/2987)
- [mfyz Node Excel library comparison](https://mfyz.com/nodejs-excel-library-comparison/) (24 Mar 2026)
- [ExcelForge README](https://github.com/node-projects/excelForge)
