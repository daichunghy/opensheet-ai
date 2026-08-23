import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { handler } from "../examples/serverless-handler.mjs";
import { IntentValidationError } from "../src/core/errors.js";
import { compileScaleBank } from "../src/index.js";

describe("integration examples", () => {
  it("use the public memory adapter preview boundary", async () => {
    for (const filename of ["node-service.mjs", "serverless-handler.mjs"]) {
      const source = await readFile(new URL(`../examples/${filename}`, import.meta.url), "utf8");
      expect(source).toContain("memoryAdapter.preview");
      expect(source).not.toContain("executeInMemory");
    }
  });

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

  it("fails closed for an unsupported intent module", async () => {
    const response = await handler({ module: "not-a-module", version: 1, workbook: "ops-demo" });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("Unsupported intent module");
  });
});
