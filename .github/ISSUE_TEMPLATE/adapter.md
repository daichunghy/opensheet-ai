---
name: Adapter
about: Report an adapter capability, preflight, or execution issue
title: "[adapter] "
---

## Adapter

- adapterId:
- adapterVersion:
- plan version: `opensheet.plan.v1`

The in-memory adapter is the only implemented adapter. Do not claim Excel, Google Sheets, or other runtimes without native evidence.

## Capability

Does the adapter declare the operation as `supported` or `unsupported`?

## Reproduction

1. Plan or typed intent:
2. Policy / preconditions / previousReceipt:
3. dry-run or apply:

## Evidence

- [ ] dry-run receipt
- [ ] apply or blocked receipt
- [ ] snapshot / semantic diff
- [ ] caller-owned workbook was not mutated

## Failure class

- [ ] unsupported operation executed or ignored
- [ ] precondition mismatch mutated state
- [ ] receipt digest does not verify
- [ ] idempotent replay incorrectly skipped or applied
