import { createWorkflow, workflowEvent } from "fluere";
import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { getContext } from "fluere";

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

export const fileParseWorkflow = createWorkflow({
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
      if (filePath.includes("node_modules")) {
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

fileParseWorkflow.handle([readFileEvent], async ({ data: [filePath, tab] }) => {
  return readResultEvent(`${" ".repeat(tab)}${filePath}`);
});
