import { createServer } from "@llamaindex/workflow-http/server";
import { workflow } from "../../workflow/basic";
import { searchEvent, stopEvent, storeEvent } from "../../workflow/events";
import { upload } from "../../workflow/llama-parse";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection at:", reason);
});

export const POST = createServer(
  workflow,
  async (data, sendEvent) => {
    if (data.file) {
      const file = data.file;
      const job = await upload({
        file,
      });
      const text = await job.markdown();
      sendEvent(storeEvent.with(text));
    } else if (data.search) {
      const search = data.search;
      sendEvent(searchEvent.with(search));
    }
  },
  (stream) => stream.until(stopEvent),
);
