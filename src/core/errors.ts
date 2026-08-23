export const ERROR_CODES = {
  plan_not_object: "plan_not_object",
  unsupported_property: "unsupported_property",
  invalid_schema_version: "invalid_schema_version",
  invalid_identifier: "invalid_identifier",
  invalid_sheet_name: "invalid_sheet_name",
  invalid_range: "invalid_range",
  range_bounds_exceeded: "range_bounds_exceeded",
  range_reversed: "range_reversed",
  matrix_empty: "matrix_empty",
  matrix_not_rectangular: "matrix_not_rectangular",
  matrix_dimension_mismatch: "matrix_dimension_mismatch",
  invalid_cell_value: "invalid_cell_value",
  formula_not_explicit: "formula_not_explicit",
  duplicate_operation_id: "duplicate_operation_id",
  unknown_operation_kind: "unknown_operation_kind",
  invalid_format: "invalid_format",
  invalid_validation_rule: "invalid_validation_rule",
  invalid_freeze: "invalid_freeze",
  invalid_column_width: "invalid_column_width",
  empty_operations: "empty_operations",
  invalid_metadata: "invalid_metadata",
  invalid_source: "invalid_source",
  invalid_target: "invalid_target",
  invalid_operation: "invalid_operation",
  invalid_policy: "invalid_policy",
  invalid_intent: "invalid_intent",
  missing_field: "missing_field",
  duplicate_code: "duplicate_code",
  invalid_scale: "invalid_scale",
  empty_collection: "empty_collection",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface PlanIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export function planIssue(code: string, path: string, message: string): PlanIssue {
  return { code, path, message };
}

export class PlanValidationError extends Error {
  public readonly details: readonly PlanIssue[];
  public readonly issues: readonly string[];

  public constructor(details: readonly PlanIssue[]) {
    const issues = details.map((detail) => detail.message);
    super(`Invalid OpenSheet-AI plan:\n- ${issues.join("\n- ")}`);
    this.name = "PlanValidationError";
    this.details = details;
    this.issues = issues;
  }
}

export class IntentValidationError extends Error {
  public readonly details: readonly PlanIssue[];
  public readonly issues: readonly string[];

  public constructor(details: readonly PlanIssue[]) {
    const issues = details.map((detail) => detail.message);
    super(`Invalid OpenSheet-AI intent:\n- ${issues.join("\n- ")}`);
    this.name = "IntentValidationError";
    this.details = details;
    this.issues = issues;
  }
}

export class PolicyConfigurationError extends TypeError {
  public readonly code = ERROR_CODES.invalid_policy;
  public readonly path: string;
  public readonly details: readonly PlanIssue[];

  public constructor(message: string, path = "policy") {
    super(message);
    this.name = "PolicyConfigurationError";
    this.path = path;
    this.details = [planIssue(ERROR_CODES.invalid_policy, path, message)];
  }
}

export class RangeParseError extends RangeError {
  public readonly code:
    | typeof ERROR_CODES.invalid_range
    | typeof ERROR_CODES.range_bounds_exceeded
    | typeof ERROR_CODES.range_reversed;

  public constructor(
    code:
      | typeof ERROR_CODES.invalid_range
      | typeof ERROR_CODES.range_bounds_exceeded
      | typeof ERROR_CODES.range_reversed,
    message: string,
  ) {
    super(message);
    this.name = "RangeParseError";
    this.code = code;
  }
}
