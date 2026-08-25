import { existsSync } from "node:fs";

export const XLSX_INPUT_READ_FAILURE_CODE = "xlsx_input_read_failed" as const;

export type XlsxInputReadFailureReason = "missing" | "unreadable" | "invalid_workbook";

export interface XlsxInputReadDiagnostic {
  readonly type: "xlsx_input_read_failure";
  readonly code: typeof XLSX_INPUT_READ_FAILURE_CODE;
  readonly reason: XlsxInputReadFailureReason;
  readonly path: string;
  readonly message: string;
}

interface NodeReadError {
  readonly code?: unknown;
}

function nodeErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as NodeReadError).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function failureReason(error: unknown): XlsxInputReadFailureReason {
  switch (nodeErrorCode(error)) {
    case "ENOENT":
      return "missing";
    case "EACCES":
    case "EISDIR":
    case "ELOOP":
    case "ENOTDIR":
    case "EPERM":
      return "unreadable";
    default:
      return "invalid_workbook";
  }
}

export function createXlsxInputReadDiagnostic(
  path: string,
  error: unknown,
): XlsxInputReadDiagnostic {
  const reason = existsSync(path) ? failureReason(error) : "missing";
  const detail = error instanceof Error && error.message ? ` ${error.message}` : "";
  return {
    type: "xlsx_input_read_failure",
    code: XLSX_INPUT_READ_FAILURE_CODE,
    reason,
    path,
    message: `Input workbook read failed (${reason}) for '${path}'.${detail}`,
  };
}
