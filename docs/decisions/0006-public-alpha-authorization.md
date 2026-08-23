# ADR 0006: Owner-authorized public alpha

**Status:** accepted  
**Date:** 23 August 2026

## Context

ADR 0005 recorded a no-go decision while the repository was private and the owner had not authorized publication. The owner has now asked for the four Desktop projects to be completed and published clearly. The current OpenSheet-AI tree passes the local release checks and now has a public GitHub repository and npm alpha artifact.

## Decision

Publish OpenSheet-AI as a narrow public alpha:

- GitHub repository: `daichunghy/opensheet-ai`;
- npm package: `opensheet-ai@0.1.0-alpha.5` (prepared for the corrected public README and published with the `alpha` dist-tag);
- public claims remain limited to the tested deterministic core and greenfield `.xlsx` adapter;
- Google Sheets, Excel desktop, formula recalculation, SEM, ERP, payment, external adoption, and production readiness remain unproven.

## Evidence gate

Publication evidence: `npm run verify` passes, the committed tree and GitHub release are public, and the npm alpha was checked from a clean consumer directory. Consumer dependency audit still reports the known transitive ExcelJS/uuid warning; this is a follow-up hardening item, not an adoption claim.
