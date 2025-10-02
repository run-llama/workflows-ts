import * as branching from "./branching";
import * as fanInFanOut from "./fan_in_fan_out";
import * as humanInTheLoop from "./human_in_the_loop";
import * as loops from "./loops";
import * as state from "./state";
import * as tracingBase from "./tracing_base";
import * as tracingPlugin from "./tracing_plugin";
import * as workflowViz from "./workflow_viz";

// Branching exports
export const branchingWorkflow = branching.workflow;
export const branchingInputEvent = branching.inputEvent;
export const branchingSuccessEvent = branching.successEvent;

// Fan-in Fan-out exports
export const fanInFanOutWorkflow = fanInFanOut.workflow;
export const fanInFanOutStartEvent = fanInFanOut.startEvent;
export const fanInFanOutProcessItemEvent = fanInFanOut.processItemEvent;
export const fanInFanOutResultEvent = fanInFanOut.resultEvent;
export const fanInFanOutCompleteEvent = fanInFanOut.completeEvent;

// Human in the loop exports
export const humanInTheLoopWorkflow = humanInTheLoop.workflow;
export const humanInTheLoopStartEvent = humanInTheLoop.startEvent;
export const humanInTheLoopHumanRequestEvent = humanInTheLoop.humanRequestEvent;
export const humanInTheLoopHumanResponseEvent =
  humanInTheLoop.humanResponseEvent;
export const humanInTheLoopStopEvent = humanInTheLoop.stopEvent;

// Loops exports
export const loopsWorkflow = loops.workflow;
export const loopsStartEvent = loops.startEvent;
export const loopsStopEvent = loops.stopEvent;

// State exports
export const stateWorkflow = state.workflow;
export const stateStartEvent = state.startEvent;
export const stateStopEvent = state.stopEvent;

// Tracing base exports
export const tracingBaseWorkflow = tracingBase.workflow;
export const tracingBaseStepEvent = tracingBase.stepEvent;

// Tracing plugin exports
export const tracingPluginWorkflow = tracingPlugin.workflow;

// Workflow viz exports
export const workflowVizWorkflow = workflowViz.workflow;
export const workflowVizStartEvent = workflowViz.startEvent;
export const workflowVizDoneEvent = workflowViz.doneEvent;
