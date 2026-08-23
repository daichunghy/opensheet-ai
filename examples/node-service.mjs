#!/usr/bin/env node
import { createServer } from "node:http";
import { compileGapMap, compileKpiThreshold, compileScaleBank } from "opensheet-ai";
import { createEmptyWorkbook, memoryAdapter } from "opensheet-ai/memory";

const port = Number(process.env.PORT ?? 8787);

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

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/plan") {
    response.writeHead(404);
    response.end("POST /plan with a typed intent JSON body\n");
    return;
  }
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  try {
    const intent = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const compiled = compile(intent);
    const result = memoryAdapter.preview(
      compiled.plan,
      createEmptyWorkbook(compiled.plan.target.workbook),
    );
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(result.receipt));
  } catch (error) {
    response.writeHead(400, { "content-type": "text/plain" });
    response.end(error instanceof Error ? error.message : String(error));
  }
}).listen(port, () => {
  process.stdout.write(`opensheet-ai node service on :${String(port)}\n`);
});
