# ADR 0006: Owner-authorized public alpha

**Status:** accepted  
**Date:** 23 August 2026

## Context

ADR 0005 recorded a no-go decision while the repository was private and the owner had not authorized publication. The owner has now asked for the four Desktop projects to be completed and published clearly. The current OpenSheet-AI tree passes the local release checks, but it still has no public repository or registry artifact.

## Decision

Publish OpenSheet-AI as a narrow public alpha:

- GitHub repository: `daichunghy/opensheet-ai`;
- npm package: `opensheet-ai@0.1.0-alpha.2` (prepared; registry publication still requires npm OTP verification);
- public claims remain limited to the tested deterministic core and greenfield `.xlsx` adapter;
- Google Sheets, Excel desktop, formula recalculation, SEM, ERP, payment, external adoption, and production readiness remain unproven.

## Evidence gate

Before publication, run `npm run verify` and confirm that the committed tree, GitHub default branch, release tag, and npm tarball contain the same version and package boundary. After publication, re-check the public repository and package from a clean consumer directory.
