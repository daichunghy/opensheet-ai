# Adapter capability matrix

**Date:** 23 August 2026  
**Plan version:** `opensheet.plan.v1`

| Operation | Memory | `.xlsx` greenfield | Google Sheets |
| --- | --- | --- | --- |
| `ensure-sheet` | supported | supported | not implemented |
| `write-range` (literals, including `=...`) | supported | supported | not implemented |
| `write-formulas` | supported, default policy blocked | supported, default policy blocked | not implemented |
| `set-data-validation` | supported | supported | not implemented |
| `set-format` | supported | supported | not implemented |
| `freeze-pane` | supported | supported | not implemented |
| `set-column-widths` | supported | supported | not implemented |
| dry-run | non-mutating clone | no file written | — |
| apply | cloned workbook | new `.xlsx` file | — |
| overwrite existing target | n/a | blocked unless `overwrite=true` | — |
| read existing workbook | JSON memory object | allowlist required; media/merges/images fail closed | — |
| formula recalculation | no | no | — |

Evidence: `test/conformance.adapters.test.ts`, `test/xlsx.conformance.test.ts`, `docs/research/2026-08-22-f1-adapter-choice.md`.
