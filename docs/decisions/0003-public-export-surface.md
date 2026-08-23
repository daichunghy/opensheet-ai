# ADR 0003: Split the public export surface from the in-memory adapter

**Status:** accepted  
**Date:** 23 August 2026

## Context

Architecture §6 said `executeInMemory` is not the final public adapter interface. F0 exported memory types from the package root. That would freeze an experimental runtime as the default contract.

## Decision

- `opensheet-ai` (`"."`) exports plan types, validation, policy, compilers, capability, snapshot, receipt, and errors.
- `opensheet-ai/memory` exports the in-memory adapter, `executeInMemory`, and `memoryAdapter`.
- Adapters implement `SheetAdapter`.

This is a local `0.0.0-dev` break. There is no public semver yet.

## Consequences

Hosts must import execution from `opensheet-ai/memory` (and later `opensheet-ai/xlsx`). The core package can grow adapters without making `MemoryWorkbook` the default type.
