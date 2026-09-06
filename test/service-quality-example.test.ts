import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { compileScaleBank } from "../src/index.js";
import { createEmptyWorkbook, memoryAdapter } from "../src/adapters/memory.js";

const execFileAsync = promisify(execFile);

interface ServiceQualityArtifact {
  readonly schemaVersion: string;
  readonly example: string;
  readonly provenance: {
    readonly label: string;
    readonly statement: string;
    readonly itemSources: string;
    readonly execution: string;
    readonly network: boolean;
    readonly model: boolean;
    readonly credentials: boolean;
    readonly nativeExcelOrGoogleSheets: boolean;
  };
  readonly plan: {
    readonly operations: readonly {
      readonly kind: string;
      readonly values?: readonly (readonly unknown[])[];
    }[];
  };
  readonly planDigest: string;
  readonly summary: {
    readonly operationCount: number;
    readonly touchedCellCount: number;
    readonly containsFormulaWrites: boolean;
    readonly constructCount: number;
    readonly itemCount: number;
    readonly reverseKeyedItemCount: number;
  };
  readonly constructs: readonly {
    readonly code: string;
    readonly itemCount: number;
    readonly reverseItemCodes: readonly string[];
  }[];
  readonly reverseKeyedItems: readonly {
    readonly constructCode: string;
    readonly itemCode: string;
    readonly itemText: string;
  }[];
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

const root = fileURLToPath(new URL("..", import.meta.url));

describe("service-quality scale-bank example", () => {
  it("compiles a deterministic multi-factor plan with a reverse-key marker", async () => {
    const intent = JSON.parse(
      await readFile(new URL("../examples/service-quality/intent.json", import.meta.url), "utf8"),
    ) as unknown;
    const artifact = JSON.parse(
      await readFile(new URL("../examples/service-quality/preview.json", import.meta.url), "utf8"),
    ) as ServiceQualityArtifact;
    const compiled = compileScaleBank(intent);

    expect(artifact.schemaVersion).toBe("opensheet.example-artifact.v1");
    expect(artifact.example).toBe("service-quality");
    expect(artifact.provenance).toMatchObject({
      label: "demonstration",
      itemSources: "demonstration-only; no citation supplied",
      execution: "local memory adapter",
      network: false,
      model: false,
      credentials: false,
      nativeExcelOrGoogleSheets: false,
    });
    expect(artifact.provenance.statement).toMatch(/not a validated measurement instrument/i);
    expect(artifact.plan).toEqual(compiled.plan);
    expect(artifact.planDigest).toBe(compiled.digest);
    expect(artifact.summary).toMatchObject({
      operationCount: 6,
      constructCount: 4,
      itemCount: 12,
      reverseKeyedItemCount: 1,
      containsFormulaWrites: false,
    });
    expect(artifact.constructs.map((construct) => construct.code)).toEqual([
      "RELIABILITY",
      "RESPONSIVENESS",
      "ASSURANCE",
      "SATISFACTION",
    ]);
    expect(artifact.constructs.every((construct) => construct.itemCount === 3)).toBe(true);
    expect(artifact.reverseKeyedItems).toEqual([
      {
        constructCode: "SATISFACTION",
        itemCode: "SAT3",
        itemText: "Choosing this service was a poor decision.",
      },
    ]);
    expect(artifact.table).toHaveLength(12);
    expect(artifact.table.filter((row) => row.Reverse === true)).toEqual([
      expect.objectContaining({ "Item Code": "SAT3", "Construct Code": "SATISFACTION" }),
    ]);
    expect(artifact.table.every((row) => String(row.Source).startsWith("Demonstration item;"))).toBe(true);
    expect(artifact.preview).toMatchObject({
      status: "dry-run",
      planDigest: compiled.digest,
      afterDigest: artifact.preview.beforeDigest,
      findings: [],
    });
    expect(artifact.preview.projectedAfterDigest).not.toBe(artifact.preview.afterDigest);
    expect(artifact.memoryApply.status).toBe("applied");
    expect(artifact.memorySnapshot.sheets).toHaveLength(1);
    expect(artifact.memorySnapshot.sheets[0]?.name).toBe("Service Quality Scale Bank");
    expect(artifact.memorySnapshot.sheets[0]?.cells.some((cell) => cell.kind === "formula")).toBe(false);

    const planOperation = artifact.plan.operations.find((operation) => operation.kind === "write-range");
    expect(planOperation?.values).toHaveLength(13);

    const preview = memoryAdapter.preview(compiled.plan, createEmptyWorkbook("service-quality-research-demo"), {
      executor: "test/service-quality",
      now: () => "2026-08-27T00:00:00.000Z",
    });
    expect(preview.receipt).toMatchObject({ status: "dry-run", findings: [] });
    expect(preview.receipt.afterDigest).toBe(preview.receipt.beforeDigest);
  });

  it("replays the checked-in artifact through its executable public-API script", async () => {
    const scriptPath = fileURLToPath(new URL("../examples/service-quality/preview.mjs", import.meta.url));
    const artifact = JSON.parse(
      await readFile(new URL("../examples/service-quality/preview.json", import.meta.url), "utf8"),
    ) as ServiceQualityArtifact;
    const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
      cwd: root,
      maxBuffer: 4 * 1024 * 1024,
    });
    expect(JSON.parse(stdout)).toEqual(artifact);
  });
});
