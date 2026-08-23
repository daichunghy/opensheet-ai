# Partial failure and retry

## In-memory

`executeInMemory` clones, applies the whole plan, then returns. There is no partial apply. A blocked policy/preflight/precondition returns the original clone and a `blocked` receipt.

## `.xlsx`

- Dry-run does not create the output file.
- Apply writes one complete file with ExcelJS `writeFile`.
- If the output path exists, the adapter blocks with `overwrite_refused` unless `overwrite: true`.
- There is no append, no mid-file checkpoint, and no retry of a half-written ZIP.
- After apply, the adapter reads the file back into a snapshot. Cell-level mismatch is a test failure, not a silent success.
- Timeouts are not retried. Treat an interrupted write as unknown; delete the incomplete file and rerun the full plan.

## Not implemented

Google Sheets `batchUpdate` timeout-after-partial-commit. Do not copy Sheets retry lore onto the file adapter.
