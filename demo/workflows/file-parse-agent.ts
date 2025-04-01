import { createWorkflow, workflowEvent, getContext } from "@llamaindex/flow";
import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { until } from "@llamaindex/flow/stream";
import { withStore } from "@llamaindex/flow/middleware/store";

export const messageEvent = workflowEvent<string>({
  debugLabel: "message",
});

const startEvent = workflowEvent<string>({
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
const stopEvent = workflowEvent({
  debugLabel: "stop",
});

export const fileParseWorkflow = withStore(
  {
    output: "",
  },
  createWorkflow({
    startEvent,
    stopEvent,
  }),
);

const locks: {
  finish: boolean;
}[] = [];

fileParseWorkflow.handle([startEvent], async ({ data: dir }) => {
  const { stream, sendEvent } = getContext();
  sendEvent(readDirEvent([dir, 0]));
  await until(stream, () => locks.length > 0 && locks.every((l) => l.finish));
  return stopEvent();
});

const als = new AsyncLocalStorage<{
  finish: boolean;
}>();
fileParseWorkflow.handle([readDirEvent], async ({ data: [dir, tab] }) => {
  getContext().sendEvent(messageEvent(dir));
  const { sendEvent } = getContext();
  const items = await readdir(dir);
  fileParseWorkflow.getStore().output += " ".repeat(tab) + dir + "\n";
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
        als.run(lock, () => sendEvent(readFileEvent([filePath, tab + 2])));
        locks.push(lock);
      } else if (s.isDirectory()) {
        als.run(lock, () => sendEvent(readDirEvent([filePath, tab + 2])));
        locks.push(lock);
      }
    }),
  );
  const lock = als.getStore();
  if (lock) {
    lock.finish = true;
  }
  return readResultEvent();
});

fileParseWorkflow.handle([readFileEvent], async ({ data: [filePath, tab] }) => {
  const lock = als.getStore();
  if (lock) {
    lock.finish = true;
  }
  getContext().sendEvent(messageEvent(filePath));
  fileParseWorkflow.getStore().output += " ".repeat(tab) + filePath + "\n";
  return readResultEvent();
});
