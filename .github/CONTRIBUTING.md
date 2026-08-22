# Contributing

OpenSheet-AI welcomes focused changes that strengthen the versioned plan contract, deterministic compilers, policy boundary, adapters, documentation, or tests.

Before opening a pull request:

1. Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/THREAT_MODEL.md`.
2. Keep planning code free of network access, credentials, model calls, and implicit time.
3. Add regression and negative tests for changed behavior.
4. Run `npm run verify`.
5. State which product boundary changes, if any, the pull request proposes.

Do not submit generated packages, credentials, real customer workbook data, or unverifiable claims of adapter support.
