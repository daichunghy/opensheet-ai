import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  REQUIRED_REPOSITORY_FILES,
  REQUIRED_PACK_FILES,
  checkReleaseCandidate,
  findProhibitedDocumentationClaims,
  inspectPackFiles,
  parsePackFilePaths,
} from "../scripts/check-release-candidate.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

function packJson(paths: readonly string[]) {
  return JSON.stringify([{ files: paths.map((path) => ({ path })) }]);
}

describe("offline release-candidate gate", () => {
  it("passes the current package with an injected local pack result", () => {
    const report = checkReleaseCandidate({
      root,
      packRunner: () => ({ status: 0, stdout: packJson(REQUIRED_PACK_FILES), stderr: "" }),
    });

    expect(report.status).toBe("pass");
    expect(report.failures).toEqual([]);
  });

  it("parses npm pack JSON and rejects source-only package roots", () => {
    const paths = parsePackFilePaths(
      `notice [local-only]\n${packJson(["package.json", "dist/index.js", "src/index.ts", "test/a.test.ts"])}`,
    );
    const inspection = inspectPackFiles(paths);

    expect(inspection.leakedFiles).toEqual(["src/index.ts", "test/a.test.ts"]);
    expect(inspection.missingFiles).toContain("README.md");
  });

  it("requires both shipped sample workbooks in source and npm pack output", async () => {
    const sampleWorkbooks = [
      "examples/inventory-revenue/sample.xlsx",
      "examples/service-quality/sample.xlsx",
    ];

    expect(REQUIRED_REPOSITORY_FILES).toEqual(expect.arrayContaining(sampleWorkbooks));
    expect(REQUIRED_PACK_FILES).toEqual(expect.arrayContaining(sampleWorkbooks));

    const missingPackedWorkbooks = checkReleaseCandidate({
      root,
      packRunner: () => ({
        status: 0,
        stdout: packJson(REQUIRED_PACK_FILES.filter((path) => !sampleWorkbooks.includes(path))),
        stderr: "",
      }),
    });
    expect(missingPackedWorkbooks.status).toBe("fail");
    expect(missingPackedWorkbooks.failures).toContainEqual(
      expect.objectContaining({
        check: "package-surfaces",
        message: expect.stringContaining(sampleWorkbooks.join(", ")),
      }),
    );

    const fixture = await mkdtemp(join(tmpdir(), "opensheet-release-candidate-samples-"));
    try {
      for (const path of REQUIRED_REPOSITORY_FILES.filter((path) => !sampleWorkbooks.includes(path))) {
        const destination = join(fixture, path);
        await mkdir(join(destination, ".."), { recursive: true });
        await writeFile(destination, "");
      }
      await writeFile(
        join(fixture, "package.json"),
        JSON.stringify({ private: false, version: "0.1.0-alpha.5" }),
      );
      await writeFile(
        join(fixture, "package-lock.json"),
        JSON.stringify({ packages: { "": { version: "0.1.0-alpha.5" } } }),
      );

      const missingSourceWorkbooks = checkReleaseCandidate({
        root: fixture,
        packRunner: () => ({ status: 0, stdout: packJson(REQUIRED_PACK_FILES), stderr: "" }),
      });

      expect(missingSourceWorkbooks.status).toBe("fail");
      expect(missingSourceWorkbooks.failures).toEqual(
        expect.arrayContaining(
          sampleWorkbooks.map((path) => expect.objectContaining({ check: "required-files", message: `Missing file: ${path}` })),
        ),
      );
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });

  it("allows explicit negative support/adoption boundaries but rejects affirmative claims", () => {
    const findings = findProhibitedDocumentationClaims([
      {
        path: "safe.md",
        text: "It does not connect to native Excel or Google Sheets. Adoption is not verified.",
      },
      {
        path: "unsafe.md",
        text: "It does not connect to native Excel. This project is used by external teams and supports native Google Sheets.",
      },
    ]);

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.path)).toEqual(["unsafe.md", "unsafe.md"]);
  });

  it("fails closed for a private package or a non-alpha version", async () => {
    const fixture = await mkdtemp(join(tmpdir(), "opensheet-release-candidate-"));
    try {
      for (const path of [
        "README.md",
        "LICENSE",
        "CHANGELOG.md",
        "docs/first-use.md",
        "docs/release-and-rollback.md",
      ]) {
        const destination = join(fixture, path);
        await mkdir(join(destination, ".."), { recursive: true });
        await writeFile(destination, "");
      }
      await writeFile(join(fixture, "package.json"), JSON.stringify({ private: true, version: "0.1.0" }));
      await writeFile(
        join(fixture, "package-lock.json"),
        JSON.stringify({ packages: { "": { version: "0.1.0" } } }),
      );

      const report = checkReleaseCandidate({
        root: fixture,
        packRunner: () => ({ status: 0, stdout: packJson(REQUIRED_PACK_FILES), stderr: "" }),
      });

      expect(report.status).toBe("fail");
      expect(report.failures.map((failure) => failure.message)).toEqual(
        expect.arrayContaining([
          "package.json must set private to false",
          "Version must be a valid alpha prerelease: 0.1.0",
        ]),
      );
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });

  it("keeps the gate offline and uses the required npm pack flags", async () => {
    const source = await readFile(new URL("../scripts/check-release-candidate.mjs", import.meta.url), "utf8");
    expect(source).toContain('"pack", "--dry-run", "--json", "--ignore-scripts"');
    expect(source).toContain("npm_config_offline");
    expect(source).not.toMatch(/npm\s+view|npm\s+install|fetch\s*\(/);
  });
});
