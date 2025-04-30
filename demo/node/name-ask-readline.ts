import { input } from "@inquirer/prompts";
import {
  workflow,
  stopEvent,
  startEvent,
  humanInteractionEvent,
} from "../workflows/human-in-the-loop";
import { until } from "@llama-flow/core/stream/until";
import { nothing } from "@llama-flow/core/stream/consumer";

const name = await input({
  message: "What is your name?",
});
const { onRequest, stream, sendEvent } = workflow.createContext();

sendEvent(startEvent.with(name));

onRequest(async (event, reason) => {
  if (humanInteractionEvent === event) {
    console.log("Requesting human interaction...");
    const name = await input({
      message: JSON.parse(reason).message,
    });
    console.log("Human interaction completed.");
    sendEvent(humanInteractionEvent.with(name));
  }
});

stream.on(stopEvent, ({ data }) => {
  console.log("AI analysis: ", data);
});

await nothing(until(stream, stopEvent));
