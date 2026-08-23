# 30-day weeks 1–3 ledger

Compressed locally on 23 August 2026. This is not publication or grant evidence.

## Week 1 (22–28 Aug)

- [x] F0 `npm run verify`
- [x] Independent F0 review (`docs/reviews/2026-08-22-f0-architecture-threat-review.md`)
- [x] Runtime vs JSON Schema reconciliation (Ajv test-only)
- [x] Pack golden (`scripts/check-pack.mjs`)
- [x] CLI smoke (`scripts/cli-smoke.mjs`)
- [x] F1 work packages tracked in `docs/backlog/F1.md` (no public GitHub issues; no remote)

## Week 2 (29 Aug – 4 Sep)

- [x] Capability, snapshot, precondition, semantic diff contracts
- [x] First adapter chosen: `.xlsx` (`docs/research/2026-08-22-f1-adapter-choice.md`, ADR 0004)
- [x] Recorded conformance fixtures in `test/fixtures/conformance/`

## Week 3 (5–11 Sep)

- [x] `.xlsx` read path + unsupported-feature preflight
- [x] Write to a new file by default
- [x] Read-back snapshot + failure receipts (policy, overwrite, allowlist, merge, stale digest)

## Week 4

- [x] Clean-room packed compile (`scripts/clean-room.mjs`)
- [x] Stay unpublished (ADR 0005)
- [x] Two local quick-start sessions (`docs/QUICKSTART.md`, `npm run check:quickstart`)
- [ ] Two **external** quick-start sessions — kit: `docs/sessions/`; Hy gửi [INVITE-VI.md](../sessions/INVITE-VI.md) hôm nay

## After week 4 (F3/F4 local)

- [x] Adapter authoring guide + conformance harness
- [x] Node / serverless / untrusted-model examples
- [x] KPI threshold module
- [ ] Publish, MCP, SEM, Google Sheets, five stranger sessions
