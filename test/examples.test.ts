import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { handler } from "../examples/serverless-handler.mjs";
import { IntentValidationError } from "../src/core/errors.js";
import { compileScaleBank } from "../src/index.js";

describe("integration examples", () => {
  it("rejects untrusted extra keys from a model-shaped payload", async () => {
    const extra = JSON.parse(
      await readFile(new URL("../examples/model-intent/untrusted-extra-key.json", import.meta.url), "utf8"),
    ) as unknown;
    expect(() => compileScaleBank(extra)).toThrow(IntentValidationError);
  });

  it("returns a dry-run receipt from the serverless handler", async () => {
    const response = await handler({
      module: "kpi-threshold",
      version: 1,
      workbook: "ops-demo",
      kpis: [{ code: "NPS", name: "NPS", actual: 42, target: 50, warnBelow: 45 }],
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { status: string };
    expect(body.status).toBe("dry-run");
  });
});
