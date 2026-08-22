# Security Policy

## Supported versions

No public version is supported yet. The repository is a local `0.0.0-dev` foundation prototype.

## Reporting

Do not open a public issue for a suspected credential leak, formula-injection path, path traversal, policy bypass, or destructive adapter behavior. Once a public repository exists, use GitHub private vulnerability reporting. Until then, contact the repository owner through an established private channel.

Do not include production tokens, customer workbook contents, payment data, or personal data in a report.

## Security boundary

The current implementation proves deterministic planning, policy evaluation, and in-memory execution only. It does not establish the security of Excel, Google Sheets, LLM, ERP, payment, or cloud adapters that have not been implemented and tested.
