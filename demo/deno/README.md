# Deno Workflow Demo

Simple workflow demo using LlamaIndex Workflows TS with Deno runtime.

## Files

- `main.ts` - Workflow definition and execution
- `main_test.ts` - Deno test suite
- `deno.json` - Deno configuration

## How it works

1. Creates workflow with start/end events
2. Uses setTimeout for async processing
3. Sends "Hello World!" message
4. Tests workflow with Deno streams

## Usage

```bash
# Run workflow
deno run main.ts

# Run with watch mode
deno task dev

# Run tests
deno test
```

## Dependencies

- `@llamaindex/workflow-core` - Workflow engine (npm)
- `@std/assert` - Deno assertions (JSR)

## Key Features

- **Deno Integration** - Native runtime support
- **JSR Imports** - JavaScript Registry
- **NPM Compatibility** - npm packages in Deno
- **Stream Testing** - Native TransformStream/WritableStream
