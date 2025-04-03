import { describe, test } from "vitest";
import { createWorkflow } from "fluere";
import { withStore } from "../middleware/store";

describe("with store", () => {
  test("no input", () => {
    const workflow = withStore(() => ({}), createWorkflow());
    workflow.createContext();
  });

  test("with input", () => {
    const workflow = withStore(
      (input: { id: string }) => ({
        id: input.id,
      }),
      createWorkflow(),
    );
    workflow.createContext({
      id: "1",
    });
  });
});
