import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { mcpTool } from "@llamaindex/workflow-core/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileParseWorkflow } from "../workflows/file-parse-agent.js";

const server = new McpServer({
  name: "Demo",
  version: "1.0.0",
});

export const startEvent = workflowEvent<{
  filePath: string;
}>();
export const stopEvent = workflowEvent<{
  content: { type: "text"; text: string }[];
}>();

const wrappedWorkflow = createWorkflow();

wrappedWorkflow.handle(
  [startEvent],
  async (context, { data: { filePath } }) => {
    const { stream, sendEvent, state } = fileParseWorkflow.createContext();
    sendEvent(startEvent.with({ filePath }));
    await stream.until(stopEvent).toArray();
    return stopEvent.with({
      content: [
        {
          type: "text",
          text: state.output,
        },
      ],
    });
  },
);

server.tool(
  "list directory",
  {
    // ModelContextProtocol SDK doesn't support zod v4 yet
    // https://github.com/modelcontextprotocol/typescript-sdk/issues/555
    filePath: z.string(),
  },
  mcpTool(wrappedWorkflow, startEvent, stopEvent),
);

const transport = new StdioServerTransport();

server.connect(transport).then(() => {
  console.log("Connected");
});
