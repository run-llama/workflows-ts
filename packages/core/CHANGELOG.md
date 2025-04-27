# @llama-flow/core

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
