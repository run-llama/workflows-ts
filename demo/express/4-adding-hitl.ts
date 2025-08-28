import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import {
  createStatefulMiddleware,
  SnapshotData,
} from "@llamaindex/workflow-core/middleware/state";
import { OpenAI } from "openai";
import {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import * as readline from "readline/promises";

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

const { withState } = createStatefulMiddleware(
  (state: AgentWorkflowState) => state,
);
const workflow = withState(createWorkflow());

let snapshotData: SnapshotData | null = null;

// Define our events
const userInputEvent = workflowEvent<{
  messages: ChatCompletionMessageParam[];
}>();
const toolCallEvent = workflowEvent<{
  toolCall: ChatCompletionMessageToolCall;
}>();
const toolResponseEvent = workflowEvent<ToolResponseEventData>();
const finalResponseEvent = workflowEvent<string>();
const humanRequestEvent = workflowEvent();
const humanResponseEvent = workflowEvent<string>();

// Initialize OpenAI client (same as before)
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

// LLM function - handles the AI reasoning
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

// Tool calling function - executes the requested tools
async function callTool(
  toolCall: ChatCompletionMessageToolCall,
): Promise<string> {
  const toolName = toolCall.function.name;
  const toolInput = JSON.parse(toolCall.function.arguments);

  // Execute the requested tool
  switch (toolName) {
    case "get_weather":
      // Mock weather API call
      const location = toolInput.location;
      return `The weather in ${location} is sunny and 72°F`;
    default:
      return `Unknown tool: ${toolName}`;
  }
}

// Handler for processing user input and LLM responses
workflow.handle([userInputEvent], async (context, event) => {
  const { sendEvent, state } = context;
  const { messages } = event.data;

  try {
    // Use our same llm() function
    const response = await llm(messages, tools);

    // Add the assistant's response to the conversation
    state.messages = [...messages, response];

    // Check if the LLM wants to call tools
    if (response.tool_calls && response.tool_calls.length > 0) {
      state.expectedToolCount = response.tool_calls.length;
      // Send tool call events for each requested tool
      for (const toolCall of response.tool_calls) {
        sendEvent(
          toolCallEvent.with({
            toolCall,
          }),
        );
      }
    } else {
      // No tools requested, send final response
      sendEvent(finalResponseEvent.with(response.content || ""));
    }
  } catch (error) {
    console.error("Error calling LLM:", error);
    sendEvent(finalResponseEvent.with("Error processing request"));
  }
});

// Handler for aggregating tool call responses
workflow.handle([toolResponseEvent], async (context, event) => {
  const { sendEvent, state } = context;
  // Collect all tool responses until we have all of them
  state.toolResponses.push(event.data);

  // Once we have all responses, continue the conversation
  if (state.toolResponses.length === state.expectedToolCount) {
    // Add tool response messages
    const finalMessages = [
      ...state.messages,
      // TODO: simplify this using openai type
      ...state.toolResponses.map((response) => ({
        role: "tool" as const,
        content: response.toolResponse,
        tool_call_id: response.toolId,
      })),
    ];

    // Continue the loop with the updated conversation
    sendEvent(userInputEvent.with({ messages: finalMessages }));
  }
});

// Handler for executing tool calls
workflow.handle([toolCallEvent], async (context, event) => {
  const { toolCall } = event.data;
  const { sendEvent, state } = context;

  try {
    if (toolCall.function.name.startsWith("human_")) {
      // delegate to human if tool call starts with "human_"
      state.humanToolId = toolCall.id;
      sendEvent(humanRequestEvent.with());
      // stop workflow
      sendEvent(finalResponseEvent.with("Waiting for human response"));
    } else {
      // normal machine tool call
      const toolResponse = await callTool(toolCall);
      // Send the tool response back
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

workflow.handle([humanResponseEvent], async (context, event) => {
  const { sendEvent, state } = context;
  sendEvent(
    toolResponseEvent.with({
      toolResponse: "My name is " + event.data,
      toolId: state.humanToolId!,
    }),
  );
});

// Run the workflow
const context = workflow.createContext({
  expectedToolCount: 0,
  messages: [],
  toolResponses: [],
  humanToolId: null,
});

context.stream.on(humanRequestEvent, async () => {
  // workflow is interrupted by a human request, we need to save the current state
  snapshotData = await context.snapshot();
});

context.sendEvent(
  userInputEvent.with({
    messages: [
      {
        role: "user",
        content:
          "What's the weather in San Francisco and what is the user's name?",
      },
    ],
  }),
);

await context.stream.until(finalResponseEvent).toArray();

if (!snapshotData) {
  throw new Error("No snapshot data");
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const userName = await rl.question("Name? ");
rl.close();

const resumedContext = workflow.resume(snapshotData);
resumedContext.sendEvent(humanResponseEvent.with(userName));

const result = await resumedContext.stream.until(finalResponseEvent).toArray();

console.log(result[result.length - 1].data);
