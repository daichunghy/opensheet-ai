#!/usr/bin/env node
import { createServer } from "node:http";
import { compileKpiThreshold, compileScaleBank } from "../dist/index.js";
import { createEmptyWorkbook, executeInMemory } from "../dist/adapters/memory.js";

const port = Number(process.env.PORT ?? 8787);

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
    const compiled =
      intent?.module === "kpi-threshold" ? compileKpiThreshold(intent) : compileScaleBank(intent);
    const result = executeInMemory(compiled.plan, createEmptyWorkbook(compiled.plan.target.workbook), {
      dryRun: true,
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(result.receipt));
  } catch (error) {
    response.writeHead(400, { "content-type": "text/plain" });
    response.end(error instanceof Error ? error.message : String(error));
  }
}).listen(port, () => {
  process.stdout.write(`opensheet-ai node service on :${String(port)}\n`);
});
