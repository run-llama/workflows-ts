# @llamaindex/workflow-core

## 1.1.0

### Minor Changes

- f1f7954: feat: polyfill async context

## 1.0.0

### Major Changes

- 095fb04: chore: major release

  🌊 is a simple, lightweight workflow engine, in TypeScript.

  ### First, define events

  ```ts
  import { workflowEvent } from "@llamaindex/workflow-core";

  const startEvent = workflowEvent<string>();
  const stopEvent = workflowEvent<1 | -1>();
  ```

  ### Connect events with workflow

  ```ts
  import { createWorkflow } from "@llamaindex/workflow-core";

  const convertEvent = workflowEvent();

  const workflow = createWorkflow();

  workflow.handle([startEvent], (start) => {
    return convertEvent.with(Number.parseInt(start.data, 10));
  });
  workflow.handle([convertEvent], (convert) => {
    return stopEvent.with(convert.data > 0 ? 1 : -1);
  });
  ```

  ### Trigger workflow

  ```ts
  import { pipeline } from "node:stream/promises";

  const { stream, sendEvent } = workflow.createContext();
  sendEvent(startEvent.with());
  const allEvents = await stream.until(stopEvent).toArray();
  ```

## 0.4.6

### Patch Changes

- 59b9199: chore: bump version

## 0.4.5

### Patch Changes

- 1fb29de: chore: rename package

## 0.4.4

### Patch Changes

- 24fe0b2: Add support for zod schemas for events

## 0.4.3

### Patch Changes

- 9c17c2e: fix: build and export all middlewares to esm and cjs modules

## 0.4.2

### Patch Changes

- 23ecfc7: feat: update http protocol
- 4402a6d: fix: workflow stream extends standard readable stream
- 9c65785: feat: add `withSnapshot` middleware API

  Add snapshot API, for human in the loop feature. The API is designed for cross JavaScript platform, including node.js, browser, and serverless platform such as cloudflare worker and edge runtime
  - `workflow.createContext(): Context`
  - `context.snapshot(): Promise<[requestEvent, snapshot]>`
  - `workflow.resume(data, snapshot)`

## 0.4.1

### Patch Changes

- 1005e84: feat: add stream helper

  In this release, we built-in some stream helper (inspired from (TC39 Async Iterator Helpers)[https://github.com/tc39/proposal-async-iterator-helpers])
  - move `@llamaindex/workflow-core/stream/until` into `stream.until`
  - move `@llamaindex/workflow-core/stream/filter` into `stream.filter`
  - move `@llamaindex/workflow-core/stream/consumer` into `stream.toArray()`
  - add `stream.take(limit)`
  - add `stream.toArray()`

  ```diff
  - import { collect } from "@llamaindex/workflow-core/stream/consumer";
  - import { until } from "@llamaindex/workflow-core/stream/until";
  - import { filter } from "@llamaindex/workflow-core/stream/filter";

  -  const results = await collect(
  -    until(
  -      filter(
  -        stream,
  -        (ev) =>
  -          processedValidEvent.include(ev) || processedInvalidEvent.include(ev),
  -      ),
  -      () => {
  -        return results.length >= totalItems;
  -      },
  -    ),
  -  );
  +  const results = await stream
  +    .filter(
  +      (ev) =>
  +        processedValidEvent.include(ev) || processedInvalidEvent.include(ev),
  +    )
  +    .take(totalItems)
  +    .toArray();
  ```

## 0.4.0

### Minor Changes

- 1fb2d98: feat: add `createStatefulMiddleware` API

  Remove `withState` API, because its createContext API type is confusing people,
  causing people cannot figure out what does state belong to (whether context or workflow instance)

  # Breaking Changes

  ## State Middleware API Changes (formerly Store Middleware)

  The state middleware has been significantly improved with a new API and renamed from "store" to "state". Here are the key changes:

  ### Before

  ```typescript
  import { withState } from "@llamaindex/workflow-core/middleware/state";

  const workflow = withState(
    () => ({
      count: 0,
      history: [],
    }),
    createWorkflow(),
  );

  // Access state via getState()
  const state = workflow.getState();
  ```

  ### After

  ```typescript
  import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";

  const { withState, getContext } = createStatefulMiddleware(() => ({
    count: 0,
    history: [],
  }));

  const workflow = withState(createWorkflow());

  workflow.handle([], () => {
    const { state } = getContext();
  });

  // Access state via context.state
  const { state } = getContext();
  ```

  ### Migration Guide

  To migrate existing code:
  1. Replace `withState` import with `createStatefulMiddleware`
  2. Update state initialization to use the new API
  3. Replace `workflow.getState()` calls with `getContext().state`
  4. If using input parameters, update the state initialization accordingly
  5. Update all variable names from `state` to `state` in your code

  The new API provides better type safety, more flexibility with input parameters, and a more consistent way to access the state through the workflow context.

## 0.3.10

### Patch Changes

- f59679a: feat: add `event.uniqueId`
- f3206a9: fix: use `subscribable` as the source of truth
- 80066d0: feat: add `WorkflowStream.fromResponse/toResponse` API
- 2a18aca: feat: `stream.on` API

  ```ts
  workflow.handle([startEvent], () => {
    const { sendEvent } = getContext();
    sendEvent(messageEvent.with("Hello World"));
  });

  const { stream, sendEvent } = workflow.createContext();
  const unsubscribe = stream.on(messageEvent, (event) => {
    expect(event.data).toBe("Hello World");
  });
  sendEvent(startEvent.with());
  ```

## 0.3.9

### Patch Changes

- 8f1738a: fix: browser dist

## 0.3.8

### Patch Changes

- 89abee2: fix: module exports

## 0.3.7

### Patch Changes

- e2f8e23: feat: add rxjs binding
- 78b3141: feat: move third party to top-level

## 0.3.6

### Patch Changes

- d8ca6ee: Added helpful utils for e2e runs of workflows

## 0.3.5

### Patch Changes

- 6f6cb9d: feat(trace-events): add `getEventOrigins`
