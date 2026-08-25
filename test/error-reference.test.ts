import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateErrorReference } from "../scripts/error-reference.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

describe("structured error-code reference", () => {
  it("documents every code found in the core source", async () => {
    const result = await validateErrorReference(root);

    expect(result.errors).toEqual([]);
    expect(result.documentedCodes).toHaveLength(result.sourceCodes.length);
    expect(result.sourceCodes).toHaveLength(49);
  });
});
