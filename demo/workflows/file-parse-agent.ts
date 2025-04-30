import { createWorkflow, workflowEvent } from "@llama-flow/core";
import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { until } from "@llama-flow/core/stream/until";
import { createStatefulMiddleware } from "@llama-flow/core/middleware/state";

export const messageEvent = workflowEvent<string>({
  debugLabel: "message",
});

export const startEvent = workflowEvent<string>({
  debugLabel: "start",
});
const readDirEvent = workflowEvent<[string, number]>({
  debugLabel: "readDir",
});
const readFileEvent = workflowEvent<[string, number]>({
  debugLabel: "readFile",
});
const readResultEvent = workflowEvent({
  debugLabel: "readResult",
});
export const stopEvent = workflowEvent({
  debugLabel: "stop",
});

const { withState, getContext } = createStatefulMiddleware(() => ({
  output: "",
  apiKey: "",
}));

export const fileParseWorkflow = withState(createWorkflow());

const locks: {
  finish: boolean;
}[] = [];

fileParseWorkflow.handle([startEvent], async ({ data: dir }) => {
  const { stream, sendEvent } = getContext();
  sendEvent(readDirEvent.with([dir, 0]));
  await until(stream, () => locks.length > 0 && locks.every((l) => l.finish));
  return stopEvent.with();
});

const als = new AsyncLocalStorage<{
  finish: boolean;
}>();
fileParseWorkflow.handle([readDirEvent], async ({ data: [dir, tab] }) => {
  getContext().sendEvent(messageEvent.with(dir));
  const { sendEvent } = getContext();
  const items = await readdir(dir);
  getContext().state.output += " ".repeat(tab) + dir + "\n";
  await Promise.all(
    items.map(async (item) => {
      const filePath = resolve(dir, item);
      if (filePath.includes("node_modules")) {
        return;
      }
      const s = await stat(filePath);
      let lock = {
        finish: false,
      };
      if (s.isFile()) {
        als.run(lock, () => sendEvent(readFileEvent.with([filePath, tab + 2])));
        locks.push(lock);
      } else if (s.isDirectory()) {
        als.run(lock, () => sendEvent(readDirEvent.with([filePath, tab + 2])));
        locks.push(lock);
      }
    }),
  );
  const lock = als.getStore();
  if (lock) {
    lock.finish = true;
  }
  return readResultEvent.with();
});

fileParseWorkflow.handle([readFileEvent], async ({ data: [filePath, tab] }) => {
  const lock = als.getStore();
  if (lock) {
    lock.finish = true;
  }
  getContext().sendEvent(messageEvent.with(filePath));
  getContext().state.output += " ".repeat(tab) + filePath + "\n";
  return readResultEvent.with();
});
