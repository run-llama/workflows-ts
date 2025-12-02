/**
 * Calculator Workflow
 *
 * A workflow that performs basic math operations.
 * Input: { a: number, b: number, op: string }
 * Output: { result: number }
 */
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";

export interface CalculatorInput {
  a: number;
  b: number;
  op: string;
}

export interface CalculatorOutput {
  result: number;
}

export const calcInputEvent = workflowEvent<CalculatorInput>({
  debugLabel: "calcInput",
});

export const calcOutputEvent = workflowEvent<CalculatorOutput>({
  debugLabel: "calcOutput",
});

export const calculatorWorkflow = createWorkflow();
calculatorWorkflow.handle([calcInputEvent], (_context, event) => {
  const { a, b, op } = event.data;
  let result: number;

  switch (op) {
    case "add":
      result = a + b;
      break;
    case "subtract":
      result = a - b;
      break;
    case "multiply":
      result = a * b;
      break;
    case "divide":
      if (b === 0) {
        throw new Error("Division by zero");
      }
      result = a / b;
      break;
    default:
      throw new Error(`Unknown operation: ${op}`);
  }

  return calcOutputEvent.with({ result });
});
