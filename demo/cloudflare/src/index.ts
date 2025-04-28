import { Hono } from "hono";
import { createWorkflow, workflowEvent } from "@llama-flow/core";
import { createHonoHandler } from "@llama-flow/core/hono";
import { html } from "hono/html";
import { toolCallWorkflow } from "../../workflows/tool-call-agent";
import { filter } from "@llama-flow/core/stream/filter";
import { until } from "@llama-flow/core/stream/until";

const app = new Hono();

const startEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();
const workflow = createWorkflow();

workflow.handle([startEvent], ({ data }) => {
  return stopEvent.with(`hello, ${data}!`);
});

app.post(
  "/workflow",
  createHonoHandler(
    toolCallWorkflow,
    async (ctx, sendEvent) => {
      sendEvent(startEvent.with(await ctx.req.text()));
    },
    (stream) =>
      filter(until(stream, stopEvent), (event) => stopEvent.include(event)),
  ),
);

app.get("/", (c) => {
  return c.html(
    html`<!doctype html>
      <html>
        <head>
          <title>Workflow Demo</title>
        </head>
        <body>
          <h1>Hello!</h1>
          <span id="response" />
          <form id="workflowForm" method="POST" action="/workflow">
            <input name="name" value="world" />
            <span>Name</span>
            <button type="submit">Send event</button>
          </form>
          <script>
            document
              .getElementById("workflowForm")
              .addEventListener("submit", async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const response = await fetch("/workflow", {
                  method: "POST",
                  body: formData.get("name"),
                });
                document.getElementById("response").innerText =
                  await response.json();
              });
          </script>
        </body>
      </html>`,
  );
});

export default app;
