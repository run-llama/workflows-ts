---
"@llamaindex/workflow-core": major
---

chore: major release

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
