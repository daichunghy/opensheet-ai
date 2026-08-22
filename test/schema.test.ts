import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function readSchema(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(new URL(`../schemas/${name}`, import.meta.url), "utf8")) as Record<
    string,
    unknown
  >;
}

describe("published schemas", () => {
  it("parses the plan schema and pins the contract id", async () => {
    const schema = await readSchema("plan.v1.schema.json");
    expect(schema["$schema"]).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema["$id"]).toBe("https://opensheet-ai.dev/schemas/plan.v1.schema.json");
  });

  it("parses the receipt schema and pins the contract id", async () => {
    const schema = await readSchema("receipt.v1.schema.json");
    expect(schema["$id"]).toBe("https://opensheet-ai.dev/schemas/receipt.v1.schema.json");
  });
});
