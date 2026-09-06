import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const manifest = JSON.parse(readFileSync("fixtures/agent-evals/manifest.json", "utf8"));
const taskId = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!taskId || taskId === "--dry-run") {
  console.error("Usage: npm run agent-eval -- <OS-01..OS-08> [--dry-run]");
  process.exitCode = 2;
} else {
  const task = manifest.tasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    console.error(`Unknown agent evaluation task: ${taskId}`);
    process.exitCode = 2;
  } else {
    console.log(`Agent evaluation ${task.id}: ${task.title}`);
    console.log(`risk=${task.risk} owner=${task.owner} humanReview=${task.humanReview}`);
    console.log(`Allowed paths: ${task.paths.join(", ")}`);
    for (const command of task.commands) {
      const match = /^npm run ([a-z0-9:_-]+)$/.exec(command);
      if (!match) { console.error(`${task.id}: non-allowlisted command: ${command}`); process.exitCode = 2; break; }
      console.log(`\n$ ${command}`);
      if (dryRun) continue;
      const result = spawnSync("npm", ["run", match[1]], { stdio: "inherit" });
      if (result.error || result.status !== 0) {
        console.error(`${task.id}: acceptance command failed: ${result.error?.message ?? `exit ${String(result.status)}`}`);
        process.exitCode = result.status ?? 1;
        break;
      }
    }
    if (!process.exitCode) console.log(`\n${task.id}: acceptance commands passed; parent diff review remains required`);
  }
}
