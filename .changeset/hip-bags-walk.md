---
"@llama-flow/docs": patch
"@llama-flow/core": patch
---

feat: add `createStoreMiddleware` API

Remove `withStore` API, because its createContext API type is confusing people,
causing people cannot figure out what does store beling to (whether context or workflow instance)

#### Before

```typescript
import { withStore } from "@llama-flow/core/middleware/store";

const workflow = withStore(
  () => ({
    count: 0,
    history: [],
  }),
  createWorkflow(),
);

// Access store via getStore()
const store = workflow.getStore();
```

#### After

```typescript
import { createStoreMiddleware } from "@llama-flow/core/middleware/store";

const { withStore, getContext } = createStoreMiddleware(() => ({
  count: 0,
  history: [],
}));

const workflow = withStore(createWorkflow());

workflow.handle([], () => {
  const { store } = getContext()
})

// Access store via context.store
const { store } = getContext();
```

### Migration Guide

To migrate existing code:

1. Replace `withStore` import with `createStoreMiddleware`
2. Update store initialization to use the new API
