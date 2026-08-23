# Bundle and cold-start budgets

Measured from `dist/` JavaScript after `npm run build`. Source maps are excluded. Timing is informational and is **not** a CI gate.

## Gate

| Metric | Ceiling | Rationale |
| --- | --- | --- |
| Sum of `dist/**/*.js` bytes | 128 KiB | Raised after the `.xlsx` adapter and KPI module. Still fails the gate instead of hiding growth. |

`npm run check:budget` fails if the JS size exceeds 128 KiB (`131072` bytes).

## Latest local measurement

Recorded after F1 implementation (`npm run check:budget`):

| Metric | Value |
| --- | --- |
| `distJsBytes` | 64318 |
| `distJsKiB` | 62.81 |
| `fileCount` | 17 |
| `sizeCeilingBytes` | 102400 |
| `coldImportMs` | 12 (informational; machine-dependent) |

Re-run `npm run check:budget` after build. The script prints the same fields. Cold import time varies by machine and is not a CI gate.

## Notes

- Do not add production dependencies to chase features that belong in adapters.
- If the JS size approaches the ceiling, investigate new files before raising the limit.
