import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { handler } from "../examples/serverless-handler.mjs";
import { IntentValidationError } from "../src/core/errors.js";
import { compileKpiThreshold } from "../src/modules/kpi-threshold.js";
import { compileScaleBank } from "../src/index.js";

const execFileAsync = promisify(execFile);

interface ExampleArtifact {
  readonly schemaVersion: string;
  readonly example: string;
  readonly plan: unknown;
  readonly planDigest: string;
  readonly summary: unknown;
  readonly table: readonly Record<string, unknown>[];
  readonly preview: {
    readonly status: string;
    readonly planDigest: string;
    readonly beforeDigest: string;
    readonly afterDigest: string;
    readonly projectedAfterDigest?: string;
    readonly findings: readonly unknown[];
  };
  readonly memoryApply: { readonly status: string };
  readonly memorySnapshot: {
    readonly sheets: readonly {
      readonly name: string;
      readonly cells: readonly { readonly address: string; readonly kind: string; readonly value?: unknown }[];
    }[];
  };
}

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

  it("runs the inventory-revenue example through public exports and matches its artifact", async () => {
    const intent = JSON.parse(
      await readFile(new URL("../examples/inventory-revenue/intent.json", import.meta.url), "utf8"),
    ) as unknown;
    const artifact = JSON.parse(
      await readFile(new URL("../examples/inventory-revenue/preview.json", import.meta.url), "utf8"),
    ) as ExampleArtifact;
    const compiled = compileKpiThreshold(intent);

    expect(artifact.schemaVersion).toBe("opensheet.example-artifact.v1");
    expect(artifact.example).toBe("inventory-revenue");
    expect(artifact.plan).toEqual(compiled.plan);
    expect(artifact.planDigest).toBe(compiled.digest);
    expect(artifact.summary).toEqual(compiled.summary);
    expect(artifact.preview).toMatchObject({
      status: "dry-run",
      planDigest: compiled.digest,
      afterDigest: artifact.preview.beforeDigest,
      findings: [],
    });
    expect(artifact.preview.projectedAfterDigest).not.toBe(artifact.preview.afterDigest);
    expect(artifact.memoryApply.status).toBe("applied");
    expect(artifact.table).toEqual([
      expect.objectContaining({ "KPI Code": "ON_HAND_UNITS", Status: "below" }),
      expect.objectContaining({ "KPI Code": "DAILY_REVENUE", Status: "watch" }),
      expect.objectContaining({ "KPI Code": "FULFILLED_ORDERS", Status: "watch" }),
      expect.objectContaining({ "KPI Code": "GROSS_MARGIN", Status: "met" }),
    ]);

    const sheet = artifact.memorySnapshot.sheets.find((candidate) => candidate.name === "Inventory Revenue");
    expect(sheet).toBeDefined();
    const cells = new Map(sheet?.cells.map((cell) => [cell.address, cell]));
    expect(cells.get("A1")).toMatchObject({ kind: "value", value: "KPI Code" });
    expect(cells.get("A2")).toMatchObject({ kind: "value", value: "ON_HAND_UNITS" });
    expect(cells.get("F2")).toMatchObject({ kind: "value", value: "below" });
    expect(sheet?.cells.some((cell) => cell.kind === "formula")).toBe(false);

    const scriptPath = fileURLToPath(new URL("../examples/inventory-revenue/preview.mjs", import.meta.url));
    const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      maxBuffer: 2 * 1024 * 1024,
    });
    expect(JSON.parse(stdout)).toEqual(artifact);
  });
});
