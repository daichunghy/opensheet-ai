# OpenSheet-AI activity evidence log — 2026-08-23

**Captured at:** `2026-08-23T15:35:38Z`  
**Evidence type:** dated public-state snapshot.  
**Recheck rule:** package dist-tags and public issue state are time-sensitive; re-query them before
using this entry as current release evidence.

## Public state observed

| Item | Observed value |
|---|---|
| `main` | `4af378d550f824b5088aa66cbda0bc1e4b028e07` |
| Merged activity | [PR #8](https://github.com/daichunghy/opensheet-ai/pull/8) — registry boundary and pilot links |
| Source version | `0.1.0-alpha.5` |
| npm `alpha` dist-tag | `0.1.0-alpha.4` |
| Pilot request | [Issue #7](https://github.com/daichunghy/opensheet-ai/issues/7), open recruitment request |
| Stars / open issues | 0 / 6 at capture time |

## Verification recorded

- Local `npm run verify`: 93 tests passed; schema, pack, secret, smoke, clean-room, conformance,
  and quickstart checks passed.
- Public PR checks for #8: Node 20, Node 22, and production dependency audit passed.
- The README now links the consent-safe 35-minute invite and session protocol.

## Evidence boundary

The pilot issue is a recruitment surface, not evidence of an external session or adoption. The npm
alpha.5 publication remains blocked by npm two-factor authentication (`EOTP`). Google Sheets,
Excel desktop, model-provider, and production-integration claims remain outside this alpha snapshot.
