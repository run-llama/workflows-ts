# fluere

fluere is a simple, lightweight workflow engine, inspired
by [LlamaIndex Workflow](https://docs.llamaindex.ai/en/stable/module_guides/workflow/)

- Minimal core API (<=2kb)
- 100% Type safe
- Event-driven execution engine
- Support multiple JS runtime/framework

### First, define events

```ts
import { workflowEvent } from "fluere";

const startEvent = workflowEvent();
const stopEvent = workflowEvent();
```

### Connect events with workflow

```ts
import { createWorkflow } from "fluere";

const convertEvent = workflowEvent();

const workflow = createWorkflow({
  startEvent,
  stopEvent,
});

workflow.handle([startEvent], (start) => {
  return convertEvent(Number.parseInt(start.data, 10));
});
workflow.handle([convertEvent], (convert) => {
  return stopEvent(convert.data > 0 ? 1 : -1);
});
```

### Run workflow in multiple JS runtime/framework

```ts
// One shot execution
import { promiseHandler } from "fluere/interrupter/promise";

promiseHandler(workflow, startEvent("100"));

// Next.js
import { createNextHandler } from "fluere/interrupter/next";

export const { GET } = createNextHandler(workflow);

// Hono.js
import { createHonoHandler } from "fluere/interrupter/hono";

const handler = createHonoHandler(workflow);
```
