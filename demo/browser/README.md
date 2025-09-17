# Browser Workflow Demo

Run LlamaIndex workflows directly in the browser with React and Vite.
This demo renders workflow output and showcases the streaming APIs without any server component.

## Highlights
- Fully client-side workflow execution with the `WorkflowContext` stream API
- Event chaining example using `startEvent` and `stopEvent` to emit UI updates

## Prerequisites
- Node.js 20+
- npm, pnpm, or yarn (examples below use npm)

## Getting Started
```bash
npm install
npm run dev
```
The dev server starts on http://localhost:5173 by default.

To create a production build, run:
```bash
npm run build
npm run preview
```

## How It Works
The demo defines two events and a simple workflow in `src/App.tsx`:
```ts
const startEvent = workflowEvent();
const stopEvent = workflowEvent<string>();

workflow.handle([startEvent], (context) => {
  setTimeout(() => {
    context.sendEvent(stopEvent.with("Hello, World!"));
  }, 1000);
});

const context = workflow.createContext();
context.sendEvent(startEvent.with());
const events = await context.stream.until(stopEvent).toArray();
```
- `startEvent` triggers when the component loads.
- The handler fires an async side effect, then emits `stopEvent`.
- `context.stream.until(stopEvent)` collects the events and the component renders the payload.

## Customize the Workflow
- Edit `src/App.tsx` to add additional events, stateful middleware, or validation.
- Import React hooks to stream multiple updates or feed results into components.

## Project Structure
- `src/` – React components and workflow definition
- `public/` – Static assets served by Vite
- `vite.config.ts` – Vite configuration with the React SWC plugin

