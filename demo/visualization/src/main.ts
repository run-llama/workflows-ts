import "./style.css";
import { workflow } from "./workflow";

const container = document.getElementById("app") as HTMLElement;

workflow.draw(container, {
  defaultEdgeColor: "#999",
  layout: "force",
});
