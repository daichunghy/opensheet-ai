# ADR 0005: Remain private `0.0.0-dev` after the first three weeks

**Status:** accepted  
**Date:** 23 August 2026

## Context

The 30-day plan’s week 4 asks whether a private prerelease, public prerelease, or more hardening is justified. Local proof now includes F0, F1, a greenfield `.xlsx` adapter, recorded fixtures, CLI smoke, and a packed-tarball compile. There is still no public repository, no npm publication authorization, no external quick-start session, and ExcelJS carries moderate transitive advisories.

## Decision

Do **not** publish. Keep `private: true` and `0.0.0-dev`. Week 4 external sessions stay blocked on a human host. A public prerelease requires owner authorization plus current evidence in `docs/IMPLEMENTATION_PLAN.md` §13.

## Consequences

The packed artifact can be installed locally for clean-room checks. Downstream claims of Excel, Google Sheets, MCP, or grant eligibility remain false.
