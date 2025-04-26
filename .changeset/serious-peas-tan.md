---
"@llama-flow/core": patch
---

feat: `stream.on` API

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
