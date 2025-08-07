import {
  createWorkflow,
  workflowEvent,
  getContext,
} from "@llamaindex/workflow-core";
import { OpenAI } from "openai";
import {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

const workflow = createWorkflow();

// Define our events
const userInputEvent = workflowEvent<{
  messages: ChatCompletionMessageParam[];
}>();
const toolCallEvent = workflowEvent<{
  toolCall: ChatCompletionMessageToolCall;
}>();
const toolResponseEvent = workflowEvent<{
  toolResponse: string;
  toolId: string;
}>();
const finalResponseEvent = workflowEvent<string>();

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
workflow.handle([userInputEvent], async (event) => {
  const { sendEvent, stream } = getContext();
  const { messages } = event.data;

  try {
    // Use our same llm() function
    const response = await llm(messages, tools);

    // Add the assistant's response to the conversation
    const updatedMessages = [...messages, response];

    // Check if the LLM wants to call tools
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Send tool call events for each requested tool
      for (const toolCall of response.tool_calls) {
        sendEvent(
          toolCallEvent.with({
            toolCall,
          }),
        );
      }

      // Collect ALL tool responses before continuing
      const expectedToolCount = response.tool_calls.length;
      const toolResponses: Array<{ toolResponse: string; toolId: string }> = [];

      // Listen for tool responses until we have all of them
      await stream.filter(toolResponseEvent).forEach((responseEvent) => {
        toolResponses.push(responseEvent.data);

        // Once we have all responses, continue the conversation
        if (toolResponses.length === expectedToolCount) {
          // Add tool response messages
          const finalMessages = [
            ...updatedMessages,
            ...toolResponses.map((response) => ({
              role: "tool" as const,
              content: response.toolResponse,
              tool_call_id: response.toolId,
            })),
          ];

          // Continue the loop with the updated conversation
          sendEvent(userInputEvent.with({ messages: finalMessages }));
          return; // Exit the forEach to stop listening
        }
      });
    } else {
      // No tools requested, send final response
      sendEvent(finalResponseEvent.with(response.content || ""));
    }
  } catch (error) {
    console.error("Error calling LLM:", error);
    sendEvent(finalResponseEvent.with("Error processing request"));
  }
});

// Handler for executing tool calls
workflow.handle([toolCallEvent], async (event) => {
  const { sendEvent } = getContext();
  const { toolCall } = event.data;

  try {
    // Use our same callTool() function
    const toolResponse = await callTool(toolCall);

    // Send the tool response back
    sendEvent(
      toolResponseEvent.with({
        toolResponse,
        toolId: toolCall.id,
      }),
    );
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

// Run the workflow
const { stream, sendEvent } = workflow.createContext();

sendEvent(
  userInputEvent.with({
    messages: [
      { role: "user", content: "What's the weather in San Francisco?" },
    ],
  }),
);

const result = await stream.until(finalResponseEvent).toArray();
console.log(result[result.length - 1].data);
