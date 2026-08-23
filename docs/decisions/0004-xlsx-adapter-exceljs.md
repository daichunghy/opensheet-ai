# ADR 0004: First real adapter is greenfield `.xlsx` via ExcelJS

**Status:** accepted  
**Date:** 23 August 2026

## Context

F2 needs a credential-free CI adapter. Research (`docs/research/2026-08-22-f1-adapter-choice.md`) rejected npm `xlsx@0.18.5` and deferred Google Sheets. ExcelJS 4.4.0 is MIT, covers the seven v1 operations, and keeps a string `=SUM(1)` as a literal on read-back.

ExcelJS is inactive and pulls deprecated transitives. It is acceptable only as a **greenfield writer**: new file by default, fail-closed on media/merges/images, no silent round-trip of arbitrary workbooks.

## Decision

- Add `exceljs@4.4.0` as a production dependency imported **only** from `src/adapters/xlsx.ts`.
- Core and module compilers remain ExcelJS-free.
- Export the adapter as `opensheet-ai/xlsx`.
- Default: write a new file. Overwrite requires `overwrite: true`. Reading an existing file requires an explicit sheet allowlist.

## Consequences

The published tarball grows by ExcelJS. Dist-size budget still counts only OpenSheet JS. `npm audit --omit=dev --audit-level=high` must stay a CI gate; moderate ExcelJS transitives are documented, not hidden. Switching libraries later must not change `opensheet.plan.v1`.
