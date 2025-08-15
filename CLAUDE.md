# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

- **Build all packages**: `pnpm run build` (uses Turbo for monorepo builds)
- **Type check**: `pnpm run typecheck` (TypeScript build check across all packages)
- **Lint**: `pnpm run lint` (Prettier formatting check)
- **Fix formatting**: `pnpm run lint:fix` (Auto-format with Prettier)

### Package-specific commands

- **Core package build**: `cd packages/core && pnpm run build`
- **Core package dev**: `cd packages/core && pnpm run dev` (watch mode)
- **Core package test**: `cd packages/core && pnpm run test` (Vitest)
- **HTTP package build**: `cd packages/http && pnpm run build` (uses Bunchee)
- **HTTP package dev**: `cd packages/http && pnpm run dev` (watch mode with Bunchee)

### Testing

- **Run all tests**: `pnpm run test` (from root or individual packages)
- **Test workspace**: Tests are configured in `vitest.workspace.ts` for all packages
- **Browser tests**: Use `happy-dom` environment for browser-specific testing
- **CJS compatibility tests**: Located in `tests/cjs/` directory

## Architecture

`@llamaindex/workflow-core` is an **event-driven workflow engine** with these core concepts:

### Core Components

- **WorkflowEvent**: Type-safe event definitions created with `workflowEvent<DataType>()`
- **Workflow**: Event handler registry created with `createWorkflow()`
- **WorkflowContext**: Execution environment with stream access and event sending
- **WorkflowStream**: Extended ReadableStream with filtering, mapping, and event processing

### Event Flow Pattern

```typescript
// 1. Define events
const startEvent = workflowEvent<string>();
const stopEvent = workflowEvent<number>();

// 2. Register handlers
workflow.handle([startEvent], (start) => {
  return stopEvent.with(parseInt(start.data));
});

// 3. Execute workflow
const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with("42"));
```

### Middleware System

- **State**: `withState()` adds stateful context
- **Validation**: `withValidation()` provides type-safe event handling
- **Trace Events**: `withTraceEvents()` enables debugging and handler decorators
- **Snapshot**: `withSnapshot()` allows workflow state save/restore

### Key Directories

- `packages/core/src/core/`: Core workflow engine (event, workflow, context, stream)
- `packages/core/src/middleware/`: Middleware implementations
- `packages/core/src/stream/`: Stream utilities and helpers
- `packages/http/`: HTTP protocol adapter
- `packages/llamaindex/`: LlamaIndex integration
- `demo/`: Example implementations for various frameworks

### Monorepo Structure

- Uses pnpm workspaces with Turbo for build orchestration
- Packages are independently versioned and published with Changesets
- Demo projects showcase integrations with Next.js, Hono, Deno, browser environments
- **Main packages**: `@llamaindex/workflow-core` (core engine), `@llamaindex/workflow-http` (HTTP protocol)
- **Package exports**: Core package has extensive subpath exports for middleware, utilities, and stream helpers

### Browser Compatibility

Important: Call `getContext()` at the top level of handlers due to browser async context limitations. Calling it after await will fail in browsers.

### Testing

- Uses Vitest for testing across all packages
- Tests are colocated with source files (`.test.ts` files)
- Browser-specific tests use `happy-dom` environment
- TypeScript compilation builds configured for multiple targets (browser, Node.js, CommonJS)

### Build System

- **Core package**: Uses `tsdown` for building with multiple output formats (ESM, CJS, browser)
- **HTTP package**: Uses `bunchee` for lightweight bundling
- **Turbo**: Orchestrates builds across monorepo with dependency-aware caching
- **Lint-staged**: Automatically formats files on commit with Prettier
