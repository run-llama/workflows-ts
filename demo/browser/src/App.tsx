import reactLogo from "./assets/react.svg";
import llamaindexLogo from "/llamaindex.svg";
import "./App.css";
import {
  createWorkflow,
  getContext,
  workflowEvent,
} from "@llamaindex/workflow-core";
import { runWorkflow } from "@llamaindex/workflow-core/stream/run";
import { Suspense } from "react";

const startEvent = workflowEvent();
const stopEvent = workflowEvent<string>();

const workflow = createWorkflow();

workflow.handle([startEvent], () => {
  setTimeout(() => {
    const context = getContext();
    context.sendEvent(stopEvent.with("Hello, World!"));
  }, 1000);
});

const promise = runWorkflow(workflow, startEvent.with(), stopEvent);

function App() {
  return (
    <>
      <div>
        <a href="https://llamaindex.ai" target="_blank">
          <img src={llamaindexLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>React + Llamaindex Flow</h1>
      <div className="card">
        <p>
          <Suspense fallback="Loading...">
            {promise.then(({ data }) => data)}
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
