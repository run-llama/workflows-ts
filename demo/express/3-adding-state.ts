import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { OpenAI } from "openai";
import {
  ChatCompletionMessage as Message,
  ChatCompletionMessageParam as InputMessage,
  ChatCompletionMessageFunctionToolCall as ToolCall,
  ChatCompletionTool as Tool,
  ChatCompletionToolMessageParam as ToolResponseMessage,
} from "openai/resources/chat/completions";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";

type AgentWorkflowState = {
  expectedToolCount: number;
  messages: InputMessage[];
  toolResponses: Array<ToolResponseMessage>;
};

const stateful = createStatefulMiddleware((state: AgentWorkflowState) => state);
const workflow = stateful.withState(createWorkflow());

// Define our events
const userInputEvent = workflowEvent<{
  messages: InputMessage[];
}>();
const toolCallEvent = workflowEvent<{
  toolCall: ToolCall;
}>();
const toolResponseEvent = workflowEvent<ToolResponseMessage>();
const finalResponseEvent = workflowEvent<string>();

// Initialize OpenAI client (same as before)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define available tools
const tools: Tool[] = [
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
];

// LLM function - handles the AI reasoning
async function llm(messages: InputMessage[], tools: Tool[]): Promise<Message> {
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
async function callTool(toolCall: ToolCall): Promise<string> {
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
workflow.handle([userInputEvent], async (context, { data }) => {
  const { sendEvent, state } = context;
  const { messages } = data;

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
        if (toolCall.type !== "function") {
          throw new Error("Unsupported tool call type");
        }
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
workflow.handle([toolResponseEvent], async (context, { data }) => {
  const { sendEvent, state } = context;

  // Collect all tool responses until we have all of them
  state.toolResponses.push(data);

  // Once we have all responses, continue the conversation
  if (state.toolResponses.length === state.expectedToolCount) {
    // Add tool response messages
    const finalMessages = [...state.messages, ...state.toolResponses];

    // Continue the loop with the updated conversation
    sendEvent(userInputEvent.with({ messages: finalMessages }));
  }
});

// Handler for executing tool calls
workflow.handle([toolCallEvent], async (context, { data }) => {
  const { sendEvent } = context;
  const { toolCall } = data;

  try {
    // Use our same callTool() function
    const toolResponse = await callTool(toolCall);

    // Send the tool response back
    sendEvent(
      toolResponseEvent.with({
        role: "tool",
        content: toolResponse,
        tool_call_id: toolCall.id,
      }),
    );
  } catch (error) {
    console.error(`Error executing tool ${toolCall.function.name}:`, error);
    sendEvent(
      toolResponseEvent.with({
        role: "tool",
        content: `Error executing ${toolCall.function.name}: ${error}`,
        tool_call_id: toolCall.id,
      }),
    );
  }
});

// Run the workflow
const { stream, sendEvent } = workflow.createContext({
  expectedToolCount: 0,
  messages: [],
  toolResponses: [],
});

sendEvent(
  userInputEvent.with({
    messages: [
      { role: "user", content: "What's the weather in San Francisco?" },
    ],
  }),
);

const result = await stream.until(finalResponseEvent).toArray();
console.log(result[result.length - 1].data);
