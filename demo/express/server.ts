import express from "express";
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import {
  createStatefulMiddleware,
  request,
  SnapshotData,
} from "@llamaindex/workflow-core/middleware/state";
import { OpenAI } from "openai";
import {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { v4 as uuid } from "uuid";

type ToolResponseEventData = {
  toolResponse: string;
  toolId: string;
};

type AgentWorkflowState = {
  expectedToolCount: number;
  messages: ChatCompletionMessageParam[];
  toolResponses: Array<ToolResponseEventData>;
  humanToolId: string | null;
};

const { withState, getContext } = createStatefulMiddleware(
  (state: AgentWorkflowState) => state,
);
const workflow = withState(createWorkflow());

// Store for snapshots
const snapshots = new Map<string, SnapshotData>();

// Define our events
const userInputEvent = workflowEvent<{
  messages: ChatCompletionMessageParam[];
}>();
const toolCallEvent = workflowEvent<{
  toolCall: ChatCompletionMessageToolCall;
}>();
const toolResponseEvent = workflowEvent<ToolResponseEventData>();
const finalResponseEvent = workflowEvent<string>();
const humanResponseEvent = workflowEvent<string>();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define available tools
const tools: ChatCompletionTool[] = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get the current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and state, e.g. San Francisco, CA",
          },
        },
        required: ["location"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "human_ask_name",
      description: "Ask the user for his/her name",
    },
  },
];

// LLM function
async function llm(
  messages: ChatCompletionMessageParam[],
  tools: ChatCompletionTool[],
): Promise<ChatCompletionMessage> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages,
    tools,
    tool_choice: "auto",
  });

  const message = completion.choices[0]?.message;
  if (!message) {
    throw new Error("No response from LLM");
  }

  return message;
}

// Tool calling function
async function callTool(
  toolCall: ChatCompletionMessageToolCall,
): Promise<string> {
  const toolName = toolCall.function.name;
  const toolInput = JSON.parse(toolCall.function.arguments);

  switch (toolName) {
    case "get_weather":
      const location = toolInput.location;
      return `The weather in ${location} is sunny and 72°F`;
    default:
      return `Unknown tool: ${toolName}`;
  }
}

// Workflow handlers
workflow.handle([userInputEvent], async (event) => {
  const { sendEvent, state } = getContext();
  const { messages } = event.data;

  try {
    const response = await llm(messages, tools);
    state.messages = [...messages, response];

    if (response.tool_calls && response.tool_calls.length > 0) {
      state.expectedToolCount = response.tool_calls.length;
      for (const toolCall of response.tool_calls) {
        sendEvent(
          toolCallEvent.with({
            toolCall,
          }),
        );
      }
    } else {
      sendEvent(finalResponseEvent.with(response.content || ""));
    }
  } catch (error) {
    console.error("Error calling LLM:", error);
    sendEvent(finalResponseEvent.with("Error processing request"));
  }
});

workflow.handle([toolResponseEvent], async (event) => {
  const { sendEvent, state } = getContext();
  state.toolResponses.push(event.data);

  if (state.toolResponses.length === state.expectedToolCount) {
    const finalMessages = [
      ...state.messages,
      ...state.toolResponses.map((response) => ({
        role: "tool" as const,
        content: response.toolResponse,
        tool_call_id: response.toolId,
      })),
    ];

    sendEvent(userInputEvent.with({ messages: finalMessages }));
  }
});

workflow.handle([toolCallEvent], async (event) => {
  const { toolCall } = event.data;
  const { sendEvent, state } = getContext();

  try {
    if (toolCall.function.name.startsWith("human_")) {
      state.humanToolId = toolCall.id;
      sendEvent(request(humanResponseEvent));
    } else {
      const toolResponse = await callTool(toolCall);
      sendEvent(
        toolResponseEvent.with({
          toolResponse,
          toolId: toolCall.id,
        }),
      );
    }
  } catch (error) {
    console.error(`Error executing tool ${toolCall.function.name}:`, error);
    sendEvent(
      toolResponseEvent.with({
        toolResponse: `Error executing ${toolCall.function.name}: ${error}`,
        toolId: toolCall.id,
      }),
    );
  }
});

workflow.handle([humanResponseEvent], async (event) => {
  const { sendEvent, state } = getContext();
  sendEvent(
    toolResponseEvent.with({
      toolResponse: "My name is " + event.data,
      toolId: state.humanToolId!,
    }),
  );
});

const app = express();
app.use(express.json());

// Endpoint to start a new workflow
app.post("/workflow/start", async (req, res) => {
  try {
    const { messages } = req.body;

    const context = workflow.createContext({
      expectedToolCount: 0,
      messages: [],
      toolResponses: [],
      humanToolId: null,
    });

    context.sendEvent(userInputEvent.with({ messages }));

    context.onRequest(humanResponseEvent, async (reason) => {
      const [_, snapshotData] = await context.snapshot();
      const requestId = uuid();
      snapshots.set(requestId, snapshotData);

      res.json({
        type: "waiting_for_human",
        requestId,
        messages: context.state.messages,
      });
    });
    await context.stream.until(finalResponseEvent).toArray();
    res.json({
      type: "completed",
      messages: context.state.messages,
    });
  } catch (error) {
    console.error("Error starting workflow:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint to resume workflow with human input
app.post("/workflow/resume", async (req, res) => {
  try {
    const { requestId, userInput } = req.body;

    const snapshotData = snapshots.get(requestId);
    if (!snapshotData) {
      res.status(404).json({ error: "Request ID not found" });
      return;
    }

    const context = workflow.resume([userInput], snapshotData);
    await context.stream.until(finalResponseEvent).toArray();

    // Clean up snapshot
    snapshots.delete(requestId);

    res.json({
      type: "completed",
      messages: context.state.messages,
    });
  } catch (error) {
    console.error("Error resuming workflow:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
