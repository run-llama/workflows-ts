import { input } from "@inquirer/prompts";
import {
  humanInteractionEvent,
  humanRequestEvent,
  startEvent,
  stopEvent,
  workflow,
} from "./workflows/human-in-the-loop";

const name = await input({
  message: "What is your name?",
});
const { stream, sendEvent } = workflow.createContext();

sendEvent(startEvent.with(name));

stream.on(humanRequestEvent, async (event) => {
  console.log("Requesting human interaction...");
  const name = await input({
    message: JSON.parse(event.data).message,
  });
  console.log("Human interaction completed.");
  sendEvent(humanInteractionEvent.with(name));
});

stream.on(stopEvent, ({ data }) => {
  console.log("AI analysis: ", data);
});

await stream.until(stopEvent).toArray();
