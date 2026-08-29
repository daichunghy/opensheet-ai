# Structured error-code reference

This is the reference for the structured codes currently declared or emitted by
the deterministic core. The source of truth is `src/core/errors.ts` for stable
validation and typed error codes, plus structured finding literals in the other
`src/core/*.ts` files. `npm run check:errors` compares this table with those
sources and fails when a code is added, removed, duplicated, or left without a
cause and smallest fix.

These codes describe local validation, policy, capability, precondition,
idempotency, and receipt checks. They do not prove a Google Sheets or Excel live
write, external adoption, authorization, or production integration. The
foundation currently provides local and in-memory evidence only.

## Validation and typed error codes

| Code | Source | Cause | Smallest fix |
| --- | --- | --- | --- |
| `plan_not_object` | `src/core/errors.ts` | The plan value is null, an array, or another non-object value. | Pass a plan object. |
| `unsupported_property` | `src/core/errors.ts` | The input contains a key that the relevant contract does not accept. | Remove the unsupported key. |
| `invalid_schema_version` | `src/core/errors.ts` | The plan schema version is not `opensheet.plan.v1`. | Set `schemaVersion` to the supported version. |
| `invalid_identifier` | `src/core/errors.ts` | A plan or domain identifier is missing, empty, or outside the allowed text length. | Supply a non-empty identifier within the contract length. |
| `invalid_sheet_name` | `src/core/errors.ts` | A sheet name is empty or contains characters excluded by the sheet-name contract. | Use a valid non-empty sheet name. |
| `invalid_range` | `src/core/errors.ts` | A range is not a supported single-cell or A1 range string. | Replace it with a valid A1 range. |
| `range_bounds_exceeded` | `src/core/errors.ts` | A row or column exceeds the supported Excel-compatible bounds. | Reduce the range to the supported bounds. |
| `range_reversed` | `src/core/errors.ts` | The range bottom-right cell precedes its top-left cell. | Swap the endpoints to top-left through bottom-right order. |
| `matrix_empty` | `src/core/errors.ts` | A write matrix or one of its rows has no cells. | Provide a non-empty matrix and non-empty rows. |
| `matrix_not_rectangular` | `src/core/errors.ts` | Matrix rows have different lengths. | Make every row the same length. |
| `matrix_dimension_mismatch` | `src/core/errors.ts` | Matrix dimensions do not match the declared range dimensions. | Resize the matrix or correct the range. |
| `invalid_cell_value` | `src/core/errors.ts` | A cell value is not a supported finite spreadsheet value. | Replace it with a supported finite value. |
| `formula_not_explicit` | `src/core/errors.ts` | A literal write contains a string beginning with `=` and is therefore ambiguous as formula intent. | Use `write-formulas` for formula intent, or change the literal value. |
| `duplicate_operation_id` | `src/core/errors.ts` | Two operations use the same identifier within one plan. | Give each operation a unique identifier. |
| `unknown_operation_kind` | `src/core/errors.ts` | An operation kind is outside the closed v1 operation union. | Use a supported v1 operation kind. |
| `invalid_format` | `src/core/errors.ts` | A format object is empty or contains an unsupported field or value. | Provide a non-empty supported format object. |
| `invalid_validation_rule` | `src/core/errors.ts` | A data-validation rule is malformed or outside the supported rule subset. | Use a supported, complete validation rule. |
| `invalid_freeze` | `src/core/errors.ts` | Frozen row or column counts are not integers in the supported range. | Use integer row and column counts from 0 to 100. |
| `invalid_column_width` | `src/core/errors.ts` | Column-width input is empty or has an invalid column or width. | Supply a supported column and positive width. |
| `empty_operations` | `src/core/errors.ts` | The plan contains no operations. | Add at least one operation. |
| `invalid_metadata` | `src/core/errors.ts` | Metadata is not an object whose values are strings. | Use string-valued metadata fields. |
| `invalid_source` | `src/core/errors.ts` | The plan source is not a valid source object. | Supply the required source object fields. |
| `invalid_target` | `src/core/errors.ts` | The plan target is not a valid target object. | Supply the required target object fields. |
| `invalid_operation` | `src/core/errors.ts` | An operation is not a valid operation object. | Correct the operation shape and fields. |
| `invalid_policy` | `src/core/errors.ts` | Policy configuration has invalid budgets or permission-field types. | Use non-negative integer budgets and boolean permissions. |
| `invalid_intent` | `src/core/errors.ts` | A typed module intent is not an object or contains an invalid intent field. | Provide a valid typed intent object. |
| `missing_field` | `src/core/errors.ts` | A required domain field, such as workbook, is absent or invalid. | Populate the required field with a valid value. |
| `duplicate_code` | `src/core/errors.ts` | Construct, item, expected, or observed codes repeat within one intent. | Make each domain code unique. |
| `invalid_scale` | `src/core/errors.ts` | Scale bounds are not integers with a minimum below the maximum. | Provide valid integer bounds where min is less than max. |
| `empty_collection` | `src/core/errors.ts` | A required domain collection has no items. | Add at least one item to the collection. |

## Structured findings

Finding codes are returned in policy, preflight, precondition, idempotency, or
receipt results. They are not all thrown exceptions.

| Code | Source | Cause | Smallest fix |
| --- | --- | --- | --- |
| `unsupported_plan_version` | `src/core/capability.ts` | The adapter capability does not list the plan schema version. | Use an adapter that supports the plan version. |
| `unsupported_operation` | `src/core/capability.ts` | The adapter marks an operation kind as unsupported. | Remove or replace the operation, or choose a capable adapter. |
| `operation_budget_exceeded` | `src/core/policy.ts` | The plan has more operations than the configured maximum. | Reduce the operation count or set an intentional larger policy limit. |
| `cell_budget_exceeded` | `src/core/policy.ts` | The plan touches more cells than the configured maximum. | Reduce the touched range or set an intentional larger policy limit. |
| `sheet_not_allowed` | `src/core/policy.ts` | An operation targets a sheet outside the policy allowlist. | Target an allowlisted sheet or update the allowlist deliberately. |
| `sheet_creation_blocked` | `src/core/policy.ts` | The plan creates a sheet while sheet creation is disabled. | Use an existing sheet or explicitly allow sheet creation. |
| `formula_write_blocked` | `src/core/policy.ts` | The plan contains formula writes while formula permission is disabled. | Keep formulas blocked or explicitly opt in through policy. |
| `formatting_blocked` | `src/core/policy.ts` | The plan formats cells while formatting permission is disabled. | Remove formatting or explicitly allow it through policy. |
| `precondition_mismatch` | `src/core/preconditions.ts` | A workbook, sheet-existence, or range digest precondition does not match current state. | Reconcile current state and regenerate the specific precondition. |
| `workbook_identity_mismatch` | `src/core/preconditions.ts` | The plan target workbook identifier differs from the adapter workbook identifier. | Correct the plan target or select the intended workbook. |
| `missing_sheet` | `src/core/preconditions.ts` | An operation targets a sheet that does not exist and was not created earlier. | Add `ensure-sheet` before the operation or correct the sheet name. |
| `idempotent_replay` | `src/core/idempotency.ts` | The same applied plan already matches the current workbook state. | Treat the execution as a safe no-op; create a distinct plan for a new change. |
| `receipt_schema_invalid` | `src/core/receipt.ts` | The receipt is not a valid `opensheet.receipt.v1` record. | Produce or pass a receipt with the supported schema version. |
| `plan_digest_mismatch` | `src/core/receipt.ts` | Receipt `planDigest` differs from the compiled plan digest. | Recompute the receipt against the exact compiled plan. |
| `before_digest_mismatch` | `src/core/receipt.ts` | Receipt `beforeDigest` differs from the supplied before-workbook digest. | Verify the input workbook and recompute its digest. |
| `receipt_status_mismatch` | `src/core/receipt.ts` | Receipt status conflicts with the requested dry-run mode. | Keep the receipt status and dry-run flag consistent. |
| `after_digest_mismatch` | `src/core/receipt.ts` | Receipt `afterDigest` does not match the observed after-workbook state or required before state. | Recompute the after digest from the verified workbook state. |
| `workbook_mutated` | `src/core/receipt.ts` | A dry-run or blocked execution changed the represented workbook state. | Prevent mutation and return the original state for those paths. |
| `projected_digest_mismatch` | `src/core/receipt.ts` | A dry-run projected digest is missing or differs from the projected workbook. | Recompute `projectedAfterDigest` from the exact projected state. |
