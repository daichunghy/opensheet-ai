# Security Policy

## Supported versions

The `0.1.x` alpha line is supported for contract and security reports. The project does not promise security for external spreadsheet, cloud, ERP, payment, or model-provider adapters that are outside this repository.

## Reporting

Do not open a public issue for a suspected credential leak, formula-injection path, path traversal, policy bypass, or destructive adapter behavior. Use [GitHub private vulnerability reporting](https://github.com/daichunghy/opensheet-ai/security/advisories/new). If that form is unavailable, contact [@daichunghy](https://github.com/daichunghy) through a private GitHub channel.

Do not include production tokens, customer workbook contents, payment data, or personal data in a report.

## Security boundary

The current implementation proves deterministic planning, policy evaluation, and in-memory execution only. It does not establish the security of Excel, Google Sheets, LLM, ERP, payment, or cloud adapters that have not been implemented and tested.
