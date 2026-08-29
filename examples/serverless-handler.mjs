import { compileGapMap, compileKpiThreshold, compileScaleBank } from "opensheet-ai";
import { createEmptyWorkbook, memoryAdapter } from "opensheet-ai/memory";

function compile(intent) {
  switch (intent?.module) {
    case "gap-map":
      return compileGapMap(intent);
    case "kpi-threshold":
      return compileKpiThreshold(intent);
    case "scale-bank":
      return compileScaleBank(intent);
    default:
      throw new Error(`Unsupported intent module: ${String(intent?.module ?? "<missing>")}`);
  }
}

export async function handler(event) {
  try {
    const intent =
      typeof event === "string" ? JSON.parse(event) : event?.body ? JSON.parse(event.body) : event;
    const compiled = compile(intent);
    const result = memoryAdapter.preview(
      compiled.plan,
      createEmptyWorkbook(compiled.plan.target.workbook),
    );
    return {
      statusCode: result.receipt.status === "blocked" ? 409 : 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result.receipt),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
    };
  }
}
