import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateAdapterErrorReference } from "../scripts/adapter-error-reference.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

describe("xlsx adapter error-code reference", () => {
  it("documents every xlsx-local literal without duplicating core codes", async () => {
    const result = await validateAdapterErrorReference(root);

    expect(result.errors).toEqual([]);
    expect(result.coreCodes).toHaveLength(49);
    expect(result.xlsxLiteralCodes).toHaveLength(8);
    expect(result.adapterCodes).toHaveLength(7);
    expect(result.documentedCodes).toHaveLength(result.adapterCodes.length);
  });
});
