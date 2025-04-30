---
"@llama-flow/docs": patch
"@llama-flow/core": minor
"@llama-flow/llamaindex": patch
---

feat: add `createStatefulMiddleware` API

Remove `withState` API, because its createContext API type is confusing people,
causing people cannot figure out what does state belong to (whether context or workflow instance)

# Breaking Changes

## State Middleware API Changes (formerly Store Middleware)

The state middleware has been significantly improved with a new API and renamed from "store" to "state". Here are the key changes:

### Before

```typescript
import { withState } from "@llama-flow/core/middleware/state";

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
import { createStatefulMiddleware } from "@llama-flow/core/middleware/state";

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
