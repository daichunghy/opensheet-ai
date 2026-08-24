# Adapter-specific xlsx error-code reference

This is the companion reference for findings emitted at the local `.xlsx`
adapter boundary. These codes are not part of core `ERROR_CODES`. They describe
file-read, overwrite, round-trip, and write failures that do not belong in the
provider-neutral plan-validation contract.

The source of truth is the literal `code: "..."` findings in
`src/adapters/xlsx.ts`. `npm run check:adapter-errors` derives those literals,
subtracts codes already defined by `src/core`, and fails when an xlsx-local code
is missing, duplicated, or incorrectly added to this table. The shared core code
`sheet_not_allowed` is intentionally not repeated here.

These findings preserve the local, credential-free `.xlsx` boundary. They do
not claim support for Excel desktop, Google Sheets, formula recalculation, or
arbitrary workbook round-tripping.

| Code | Source | Cause | Smallest fix |
| --- | --- | --- | --- |
| `unsupported_workbook_feature` | `src/adapters/xlsx.ts` (`scanUnsupported`, `readToMemory`) | The input workbook contains media, drawings, images, merged cells, or another read failure that the v1 round-trip path cannot preserve. | Remove the unsupported workbook feature or start from a supported greenfield workbook. |
| `sheet_allowlist_required` | `src/adapters/xlsx.ts` (`executeXlsx`) | An existing input workbook is being read without an explicit sheet allowlist. | Pass `allowedSheets` or an equivalent policy allowlist before reading the workbook. |
| `overwrite_refused` | `src/adapters/xlsx.ts` (`executeXlsx`) | The output path already exists and overwrite was not explicitly enabled. | Write to a new output path or explicitly set `overwrite: true` with the required input and precondition safeguards. |
| `overwrite_input_required` | `src/adapters/xlsx.ts` (`executeXlsx`) | An existing output is being overwritten without an explicit input workbook state. | Pass the existing workbook through `inputPath` before requesting overwrite. |
| `overwrite_precondition_required` | `src/adapters/xlsx.ts` (`executeXlsx`) | Overwrite was enabled without a workbook or range state precondition. | Supply a verified workbook digest or range digest precondition. |
| `readback_mismatch` | `src/adapters/xlsx.ts` (`executeXlsx`) | The written file's normalized snapshot differs from the projected workbook; the output is removed. | Investigate the unsupported or lossy round-trip behavior and correct the plan or adapter path before retrying. |
| `xlsx_write_failed` | `src/adapters/xlsx.ts` (`executeXlsx`) | Writing the output file or its immediate read-back failed before snapshot comparison; the incomplete output is removed. | Check the output path, filesystem permissions, and workbook path, then retry with a valid local destination. |
