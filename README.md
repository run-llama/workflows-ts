# fluere

fluere 🌊 is a simple, lightweight workflow engine, inspired
by [LlamaIndex Workflow](https://docs.llamaindex.ai/en/stable/module_guides/workflow/)

[![Bundle Size](https://img.shields.io/bundlephobia/min/fluere)](https://bundlephobia.com/result?p=fluere)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/fluere)](https://bundlephobia.com/result?p=fluere)

- Minimal core API (<=2kb)
- 100% Type safe
- Event-driven, stream oriented programming
- Support multiple JS runtime/framework

## Usage

```shell
npm i fluere
```

### First, define events

```ts
import { workflowEvent } from 'fluere'

const startEvent = workflowEvent<string>()
const stopEvent = workflowEvent<1 | -1>()
```

### Connect events with workflow

```ts
import { createWorkflow } from 'fluere'

const convertEvent = workflowEvent()

const workflow = createWorkflow({
  startEvent,
  stopEvent
})

workflow.handle([startEvent], (start) => {
  return convertEvent(Number.parseInt(start.data, 10))
})
workflow.handle([convertEvent], (convert) => {
  return stopEvent(convert.data > 0 ? 1 : -1)
})
```

### Trigger workflow

```ts
// core utility to trigger workflow, it will run until stopEvent is emitted
import { finalize } from 'fluere'

const { data } = await finalize(workflow)

// you can also use any stream API, like node:stream to handle the workflow
import { pipeline } from 'node:stream'

const { stream, sendEvent } = workflow.createContext()
sendEvent(startEvent())
const result = await pipeline(
  stream,
  async function (source) {
    for await (const event of source) {
      if (stopEvent.include(event)) {
        return 'stop received!'
      }
    }
  }
)
console.log(result) // stop received!
```

## Concepts

- **Workflow**: A directed graph of event handlers.
- **Event**: A named signal that can be emitted with data attached.
- **Handler**: A function that processes events and can emit new events.

# LICENSE

MIT
