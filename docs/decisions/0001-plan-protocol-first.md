# ADR 0001: Build the plan protocol before model and spreadsheet adapters

**Status:** accepted
**Date:** 22 August 2026

## Context

The original proposal combined natural-language automation, spreadsheet editing, quantitative analysis, ERP/payment connectors, and OSS adoption goals. Current open-source projects already provide capable spreadsheet applications, MCP servers, headless engines, and direct mutation tools. Building another broad agent would create a large unverified surface and a weak dependency contract.

## Decision

OpenSheet-AI will first implement a provider-neutral intermediate plan, policy gate, dry-run path, adapter boundary, and receipt contract.

The foundation will use one TypeScript package with no production dependencies. Natural-language providers, MCP, `.xlsx`, Google Sheets, quantitative engines, and business connectors will be separate later adapters or plugins.

## Consequences

Positive consequences:

- core behavior is deterministic and testable without credentials;
- external projects can depend on the contract without adopting one model or backend;
- policy and evidence boundaries are explicit;
- adapter conformance can be defined before platform expansion.

Costs:

- the first release does not edit a real spreadsheet;
- direct end-user demonstrations arrive later;
- the plan vocabulary may need revision after real adapter experience.

The last cost is addressed through a private development version, conformance fixtures, and a prerelease compatibility policy before stable publication.
