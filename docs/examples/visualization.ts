import { workflow } from "./workflow_viz";

const container = document.getElementById("app") as HTMLElement;

// Optional settings:
// - layout: "force" | "none" (defaults to "force")
// - Any Sigma renderer setting can be passed as well, e.g. `defaultEdgeColor`
workflow.draw(container, {
  layout: "force",
  defaultEdgeColor: "#999",
});
