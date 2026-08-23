import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
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
  return {
    stdout,
    stderr,
    output: () => text,
  };
}

describe("CLI", () => {
  it("compiles, validates, and dry-runs the scale-bank example as a receipt", async () => {
    const compiled = capture();
    expect(await runCli(["compile", "examples/scale-bank.json"], compiled)).toBe(0);
    const plan = JSON.parse(compiled.output()) as { schemaVersion: string; target: { workbook: string } };
    expect(plan.schemaVersion).toBe("opensheet.plan.v1");

    const { writeFile, mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const directory = await mkdtemp(join(tmpdir(), "opensheet-cli-"));
    const planPath = join(directory, "plan.json");
    await writeFile(planPath, compiled.output());

    const validated = capture();
    expect(await runCli(["validate", planPath], validated)).toBe(0);
    expect(JSON.parse(validated.output()).digest).toMatch(/^sha256:/);

    const preview = capture();
    expect(await runCli(["apply-memory", planPath], preview)).toBe(0);
    const receipt = JSON.parse(preview.output()) as { status: string; schemaVersion: string };
    expect(receipt.status).toBe("dry-run");
    expect(receipt.schemaVersion).toBe("opensheet.receipt.v1");
    expect(preview.output()).not.toContain("I trust this service.");
  });

  it("compiles the gap-map example", async () => {
    const compiled = capture();
    expect(await runCli(["compile", "examples/gap-map.json"], compiled)).toBe(0);
    expect(JSON.parse(compiled.output()).source.module).toBe("gap-map");
  });

  it("rejects malformed workbook JSON instead of executing", async () => {
    const compiled = capture();
    await runCli(["compile", "examples/scale-bank.json"], compiled);
    const { writeFile, mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const directory = await mkdtemp(join(tmpdir(), "opensheet-cli-"));
    const planPath = join(directory, "plan.json");
    const workbookPath = join(directory, "workbook.json");
    await writeFile(planPath, compiled.output());
    await writeFile(workbookPath, JSON.stringify({ id: 1 }));
    const preview = capture();
    await expect(runCli(["apply-memory", planPath, workbookPath], preview)).rejects.toThrow(/id must be/);
  });
});
