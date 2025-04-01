import { mcpTool } from "fluere/interrupter/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fileParseWorkflow } from "../workflows/file-parse-agent.js";
import { createWorkflow, workflowEvent } from "fluere";
import { consume } from "fluere/stream";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "Demo",
  version: "1.0.0",
});

const startEvent = workflowEvent<{
  filePath: string;
}>();
const stopEvent = workflowEvent<{
  content: { type: "text"; text: string }[];
}>();

const wrappedWorkflow = createWorkflow({
  startEvent,
  stopEvent,
});

wrappedWorkflow.handle([startEvent], async ({ data: { filePath } }) => {
  const { stream, sendEvent } = fileParseWorkflow.createContext();
  sendEvent(fileParseWorkflow.startEvent(filePath));
  await consume(stream, fileParseWorkflow.stopEvent);
  return stopEvent({
    content: [
      {
        type: "text",
        text: fileParseWorkflow.getStore().output,
      },
    ],
  });
});

server.tool(
  "list directory",
  {
    filePath: z.string(),
  },
  mcpTool(wrappedWorkflow),
);

const transport = new StdioServerTransport();

server.connect(transport).then(() => {
  console.log("Connected");
});
