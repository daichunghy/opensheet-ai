import { describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import { runCli } from "../src/cli.js";

function capture() {
  let text = "";
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      text += String(chunk);
      callback();
    },
  });
  const stderr = new Writable({
    write(chunk, _encoding, callback) {
      text += String(chunk);
      callback();
    },
  });
  return { stdout, stderr, output: () => text };
}

describe("preview CLI", () => {
  it("compiles a typed intent and returns a non-mutating dry-run envelope", async () => {
    const io = capture();
    expect(await runCli(["preview", "examples/inventory-revenue/intent.json"], io)).toBe(0);

    const result = JSON.parse(io.output()) as {
      planDigest: string;
      plan: { schemaVersion: string };
      receipt: {
        status: string;
        beforeDigest: string;
        afterDigest: string;
        projectedAfterDigest?: string;
      };
      workbook?: unknown;
    };
    expect(result.plan.schemaVersion).toBe("opensheet.plan.v1");
    expect(result.planDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.receipt).toMatchObject({
      status: "dry-run",
      afterDigest: result.receipt.beforeDigest,
    });
    expect(result.receipt.projectedAfterDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.receipt.projectedAfterDigest).not.toBe(result.receipt.afterDigest);
    expect(result.workbook).toBeUndefined();
  });

  it("includes the memory workbook only when explicitly requested", async () => {
    const io = capture();
    expect(
      await runCli(["preview", "examples/inventory-revenue/intent.json", "--print-workbook"], io),
    ).toBe(0);
    const result = JSON.parse(io.output()) as { workbook?: { id?: string } };
    expect(result.workbook?.id).toBe("retail-ops-demo");
  });

  it("prints a concise human-readable summary when text format is requested", async () => {
    const io = capture();
    expect(
      await runCli(["preview", "examples/inventory-revenue/intent.json", "--format", "text"], io),
    ).toBe(0);

    const output = io.output();
    expect(output).toMatch(/Intent\/source:\s+kpi-threshold v1/);
    expect(output).toMatch(/Plan:\s+\d+ operation\(s\)/);
    expect(output).toMatch(/Receipt status:\s+dry-run/);
    expect(output).toContain("Output:");
    expect(output).toContain("Next step:");
    expect(output).not.toContain('"operations"');
    expect(output).not.toContain('"plan"');
  });

  it("renders blocked previews with findings and remediation guidance", async () => {
    const { mkdtemp, writeFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const directory = await mkdtemp(join(tmpdir(), "opensheet-preview-"));
    const workbookPath = join(directory, "workbook.json");
    await writeFile(workbookPath, JSON.stringify({ id: "different-workbook", sheets: {} }));

    const io = capture();
    expect(
      await runCli(
        [
          "preview",
          "examples/inventory-revenue/intent.json",
          "--format",
          "text",
          "--in",
          workbookPath,
        ],
        io,
      ),
    ).toBe(1);

    const output = io.output();
    expect(output).toMatch(/Receipt status:\s+blocked/);
    expect(output).toMatch(/workbook_identity_mismatch/);
    expect(output).toMatch(/no operations were applied/i);
    expect(output).toMatch(/run preview again/i);
    expect(output).not.toContain('"operations"');
  });

  it("fails closed for an intent with an unsupported extra key", async () => {
    const io = capture();
    await expect(runCli(["preview", "examples/model-intent/untrusted-extra-key.json"], io)).rejects.toThrow(
      /unsupported|extra|intent/i,
    );
  });

  it("keeps typed-intent validation fail-closed in text mode", async () => {
    const io = capture();
    await expect(
      runCli(["preview", "examples/model-intent/untrusted-extra-key.json", "--format", "text"], io),
    ).rejects.toThrow(/unsupported|extra|intent/i);
    expect(io.output()).toBe("");
  });
});
