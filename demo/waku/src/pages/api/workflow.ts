import { createServer } from "@llama-flow/http/server";
import { workflow } from "../../workflow/basic";
import { upload } from "../../workflow/llama-parse";
import { startEvent, stopEvent } from "../../workflow/events";

export const POST = createServer(
  workflow,
  async (data, sendEvent) => {
    const file = data.file;
    try {
      const job = await upload({
        file,
      });
      const text = await job.markdown();
      console.log("text", text);
      sendEvent(startEvent.with());
    } catch (e) {
      console.log(e);
    }
  },
  (stream) => stream.until(stopEvent),
);
