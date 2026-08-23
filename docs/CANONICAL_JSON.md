# Canonical JSON and SHA-256 digests

**Status:** local foundation dialect  
**Date:** 23 August 2026

OpenSheet-AI plan and workbook-state digests use a **small custom canonical JSON**, not RFC 8785 (JCS). A second implementation must copy these rules. Do not hash `JSON.stringify` output.

## Algorithm

1. `null` → `null`
2. string / boolean → `JSON.stringify`
3. finite number → `JSON.stringify` (this dialect currently emits `-0` as `0` because `JSON.stringify(-0)` is `0`)
4. non-finite numbers (`NaN`, `Infinity`, `-Infinity`) → reject
5. `undefined` as an object value → reject
6. array → `[` + canonical items joined by `,` + `]`
7. object → keys sorted by UTF-16 code unit, then `{` + `"key":value` pairs + `}`
8. other types → reject

Digest: `sha256:` + lowercase hex of SHA-256 over the UTF-8 canonical bytes.

Schema `$id` values such as `https://opensheet-ai.dev/schemas/...` are **identifiers**, not hosted URLs.

## Fixtures

See `test/canonical.test.ts` and `test/fixtures/canonical/`. Nested key order must not change the digest. Extra intent properties are rejected before `planId` hashing.
