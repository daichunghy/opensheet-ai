# Recorded conformance fixtures

These `opensheet.plan.v1` files are the shared fixture class for memory and `.xlsx` adapters (architecture §12). Tests load them from disk; they are not generated during the test.

| File | Class |
| --- | --- |
| `ensure-write.plan.json` | empty/ensure, rectangular write, freeze, column width |
| `literal-equals.plan.json` | formula-like literal stays a value |
| `formula-blocked.plan.json` | default-deny formula write |
