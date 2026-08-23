import type { ExecutionReceipt, PolicyFinding } from "./types.js";

export const IDEMPOTENT_REPLAY_FINDING: PolicyFinding = {
  code: "idempotent_replay",
  message: "Plan was already applied to this workbook state; execution was a no-op.",
};

export function isIdempotentReplay(
  previousReceipt: ExecutionReceipt | undefined,
  planDigest: string,
  beforeDigest: string,
): boolean {
  return (
    previousReceipt !== undefined &&
    previousReceipt.status === "applied" &&
    previousReceipt.planDigest === planDigest &&
    previousReceipt.afterDigest === beforeDigest
  );
}
