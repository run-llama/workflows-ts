import { expect, test } from "vitest";
import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { createWorkflow, getContext, workflowEvent } from "fluere";
import { promiseHandler } from "../interrupter/promise";

test("read dir recursively", async () => {
  const startEvent = workflowEvent<string>({
    debugLabel: "start",
  });
  const readDirEvent = workflowEvent<[string, number]>({
    debugLabel: "readDir",
  });
  const readFileEvent = workflowEvent<[string, number]>({
    debugLabel: "readFile",
  });
  const readResultEvent = workflowEvent<string>({
    debugLabel: "readResult",
  });
  const stopEvent = workflowEvent<string>({
    debugLabel: "stop",
  });

  const fileParseWorkflow = createWorkflow({
    startEvent,
    stopEvent,
  });

  fileParseWorkflow.handle([startEvent], async ({ data: dir }) => {
    const context = getContext();
    context.sendEvent(readDirEvent([dir, 0]));
    const { data } = await context.requireEvent(readResultEvent);
    return stopEvent(data);
  });

  fileParseWorkflow.handle([readDirEvent], async ({ data: [dir, tab] }) => {
    const context = getContext();
    const items = await readdir(dir);
    const results = await Promise.all(
      items.map(async (item) => {
        const filePath = resolve(dir, item);
        if (
          filePath.includes("node_modules") ||
          filePath.includes(".DS_Store")
        ) {
          return;
        }
        const s = await stat(filePath);
        if (s.isFile()) {
          context.sendEvent(readFileEvent([filePath, tab + 2]));
          return context.requireEvent(readResultEvent);
        } else if (s.isDirectory()) {
          context.sendEvent(readDirEvent([filePath, tab + 2]));
          return context.requireEvent(readResultEvent);
        }
      }),
    );
    return readResultEvent(
      `${dir}\n${results
        .filter(Boolean)
        .map((r) => r!.data)
        .join("\n")}`,
    );
  });

  fileParseWorkflow.handle(
    [readFileEvent],
    async ({ data: [filePath, tab] }) => {
      return readResultEvent(`${" ".repeat(tab)}${filePath}`);
    },
  );
  const textDir = resolve(import.meta.dirname, "fixtures", "text-dir");

  const result = await promiseHandler(() => fileParseWorkflow.run(textDir));
  expect(result.data).toMatchInlineSnapshot(`
    "/Users/himself65/Code/flujo/packages/fluere/tests/fixtures/text-dir
      /Users/himself65/Code/flujo/packages/fluere/tests/fixtures/text-dir/1.txt
      /Users/himself65/Code/flujo/packages/fluere/tests/fixtures/text-dir/2.txt
    /Users/himself65/Code/flujo/packages/fluere/tests/fixtures/text-dir/output
        /Users/himself65/Code/flujo/packages/fluere/tests/fixtures/text-dir/output/3.txt"
  `);
});
