import llamaindexLogo from "/llamaindex.svg";
import reactLogo from "./assets/react.svg";
import "./App.css";
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { Suspense } from "react";

const startEvent = workflowEvent();
const stopEvent = workflowEvent<string>();

const workflow = createWorkflow();

workflow.handle([startEvent], (context) => {
  setTimeout(() => {
    context.sendEvent(stopEvent.with("Hello, World!"));
  }, 1000);
});

const context = workflow.createContext();
context.sendEvent(startEvent.with());

const events = await context.stream.until(stopEvent).toArray();

function App() {
  return (
    <>
      <div>
        <a href="https://llamaindex.ai" target="_blank" rel="noopener">
          <img src={llamaindexLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noopener">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>React + Llamaindex Flow</h1>
      <div className="card">
        <p>
          <Suspense fallback="Loading...">
            {events.map(({ data }) => data)}
          </Suspense>
        </p>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
    </>
  );
}

export default App;
