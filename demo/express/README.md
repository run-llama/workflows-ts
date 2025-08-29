# Express Client-Server Workflow Example

This example demonstrates how to use the workflow engine in a client-server architecture with Express.js.

## Files

- `5-server.ts` - Express server that handles workflow execution and snapshot storage
- `5-client.ts` - Client that communicates with the server via HTTP requests

### Progression of examples

This Express client-server example is built on the following examples, in order:

1. `2a-agent-loop.ts` – basic agent loop with tool calls
2. `2b-agent-loop-workflow.ts` – agent loop implemented using workflows
3. `3-adding-state.ts` – adds workflow state management
4. `4-adding-hitl.ts` – adds human-in-the-loop (HITL) with snapshot/resume

## How it works

1. **Client sends initial request**: The client sends a POST request to `/workflow/start` with the initial messages
2. **Server processes workflow**: The server runs the workflow until it needs human input
3. **Server stores snapshot**: When human input is needed, the server stores a snapshot and returns a request ID
4. **Client gets user input**: The client prompts the user for input
5. **Client resumes workflow**: The client sends a POST request to `/workflow/resume` with the request ID and user input
6. **Server resumes and completes**: The server resumes the workflow from the snapshot and returns the final result

## Usage

1. Set your OpenAI API key:

   ```bash
   export OPENAI_API_KEY=your-api-key-here
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the server (in one terminal):

   ```bash
   pnpm run server
   ```

4. Run the client (in another terminal):
   ```bash
   pnpm run client
   ```
