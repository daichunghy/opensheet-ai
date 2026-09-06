# Release, update, and rollback

This runbook covers the current alpha contract. It does not authorize a
publish, a stable compatibility promise, a Google Sheets/Excel Desktop claim,
or a production rollout.

## Before release

1. Freeze the source commit and package version.
2. From a clean checkout, run `npm ci`, `npm run verify`, and
   `npm pack --dry-run --json`.
3. Confirm that the package contains only the intended `dist/`, schema,
   example, and documentation surfaces. Run the secret scan and clean-room
   import check from the verification command.
4. Recheck the registry with
   `npm view opensheet-ai dist-tags versions --json`; GitHub tags and npm tags
   can be different release points.
5. Only after owner authorization may a package be published or a Git tag and
   release be created. Record the exact version, tarball file list, and gate
   output.

## Consumer update

Use an exact version and replay the first-use contract:

```sh
npm install --save-exact opensheet-ai@<version>
npm run build
npm run verify
```

For a consumer smoke, compile a typed intent, validate the plan, run a memory
dry-run, and—when using the tested adapter—write a new XLSX output. The XLSX
adapter writes a new file by default; overwrite requires an explicit option and
must not be used as an implicit update mechanism.

## Rollback

1. Stop the update and record package version, plan schema, plan digest, receipt
   status, and the redacted symptom.
2. Restore the last known-good exact package version or lockfile, then rerun
   validation and a memory dry-run:

   ```sh
   npm install --save-exact opensheet-ai@<known-good-version>
   npm run verify
   ```

3. Keep raw workbook inputs and previous output files unchanged. Generate a new
   output path when checking the rollback; do not overwrite the previous file
   during diagnosis.
4. Preserve the faulty tag and release history. Do not force-push or silently
   change a published dist-tag. A replacement release requires owner approval.
5. Record whether the plan digest, adapter capability, and receipt behavior
   returned to the known-good result.

Rollback restores the consumer contract version. It does not prove native
Excel/Google Sheets behavior, recalculation, semantic correctness, or adoption.
