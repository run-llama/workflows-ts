import { OpenAI } from "openai";
import {
  ChatCompletionMessage as Message,
  ChatCompletionMessageParam as InputMessage,
  ChatCompletionMessageFunctionToolCall as ToolCall,
  ChatCompletionTool as Tool,
} from "openai/resources/chat/completions";

// Initialize OpenAI client
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

// Now implement our agent loop
async function runAgentLoop(userInput: string) {
  let messages: InputMessage[] = [{ role: "user", content: userInput }];

  while (true) {
    const response = await llm(messages, tools);

    // Add the assistant's response to the conversation
    messages.push(response);

    if (response.tool_calls) {
      // Process each tool call
      for (const toolCall of response.tool_calls) {
        if (toolCall.type !== "function") {
          throw new Error("Unsupported tool call type");
        }
        const toolResponse = await callTool(toolCall);
        messages.push({
          role: "tool",
          content: toolResponse,
          tool_call_id: toolCall.id,
        });
      }
    } else {
      // No tools needed, we have our final response
      return response.content;
    }
  }
}

// Run the agent
const result = await runAgentLoop("What's the weather in San Francisco?");
console.log(result);
