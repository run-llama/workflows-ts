import * as readline from "node:readline/promises";

const SERVER_URL = "http://localhost:3000";

async function makeRequest(endpoint: string, data: object) {
  const response = await fetch(`${SERVER_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

console.log("Starting workflow...");

// First request: Start the workflow
const initialMessages = [
  {
    role: "user" as const,
    content: "What's the weather in San Francisco and what is the user's name?",
  },
];

try {
  const startResponse = await makeRequest("/workflow/start", {
    messages: initialMessages,
  });

  if (startResponse.type !== "waiting_for_human") {
    console.log(
      "Workflow completed immediately. Messages:",
      startResponse.messages,
    );
    process.exit(0);
  }

  console.log("Workflow is waiting for human input...");
  console.log("Current messages:", startResponse.messages);

  // Get user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const userName = await rl.question("What is your name? ");
  rl.close();

  // Second request: Resume the workflow with user input
  const resumeResponse = await makeRequest("/workflow/resume", {
    requestId: startResponse.requestId,
    userInput: userName,
  });

  console.log("Final messages:", resumeResponse.messages);
} catch (error) {
  console.error("Error:", error);
}
