# XLSX input-read diagnostics

The local `.xlsx` adapter reports `xlsx_input_read_failed` when an existing
input workbook cannot be opened. This is deliberately separate from
`unsupported_workbook_feature`: a missing, unreadable, or invalid archive is
an input-read failure, while a readable workbook containing a feature that the
v1 round-trip path cannot preserve remains an unsupported-feature finding.

The typed diagnostic has this shape:

```json
{
  "type": "xlsx_input_read_failure",
  "code": "xlsx_input_read_failed",
  "reason": "missing | unreadable | invalid_workbook",
  "path": "/absolute/or/caller-supplied/input.xlsx",
  "message": "Input workbook read failed ..."
}
```

This diagnostic is local adapter evidence only. It does not prove Excel
desktop compatibility, Google Sheets connectivity, formula recalculation, or
successful recovery of a damaged workbook.
