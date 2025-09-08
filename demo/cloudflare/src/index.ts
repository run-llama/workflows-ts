import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { createHonoHandler } from "@llamaindex/workflow-core/hono";
import { Hono } from "hono";
import { html } from "hono/html";

const app = new Hono();

const startEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();
const workflow = createWorkflow();

workflow.handle([startEvent], (_context, { data }) => {
  return stopEvent.with(`hello, ${data}!`);
});

app.post(
  "/workflow",
  createHonoHandler(
    workflow,
    async (ctx) => startEvent.with(await ctx.req.text()),
    stopEvent,
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
