import { compileGapMap, compileKpiThreshold, compileScaleBank } from "../dist/index.js";
import { createEmptyWorkbook, executeInMemory } from "../dist/adapters/memory.js";

function compile(intent) {
  if (intent?.module === "gap-map") {
    return compileGapMap(intent);
  }
  if (intent?.module === "kpi-threshold") {
    return compileKpiThreshold(intent);
  }
  return compileScaleBank(intent);
}

export async function handler(event) {
  const intent = typeof event === "string" ? JSON.parse(event) : event?.body ? JSON.parse(event.body) : event;
  const compiled = compile(intent);
  const result = executeInMemory(compiled.plan, createEmptyWorkbook(compiled.plan.target.workbook), {
    dryRun: true,
  });
  return {
    statusCode: result.receipt.status === "blocked" ? 409 : 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(result.receipt),
  };
}
