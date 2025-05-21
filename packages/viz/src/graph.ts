import {
  type Handler,
  type Workflow,
  type WorkflowEvent,
} from "@llama-flow/core";
import * as babelParser from "@babel/parser";
import { type Expression } from "@babel/types";
import Graph from "graphology";

type AcceptEventsType = WorkflowEvent<any>[];
type ResultType = ReturnType<WorkflowEvent<any>["with"]> | void;

export type WithGraphWorkflow = {
  getGraph(): Graph;
};

export function withGraph<WorkflowLike extends Workflow>(
  workflow: WorkflowLike,
): WithGraphWorkflow & WorkflowLike {
  const graph = new Graph();

  return {
    ...workflow,
    handle: <
      const AcceptEvents extends AcceptEventsType,
      Result extends ResultType,
    >(
      accept: AcceptEvents,
      handler: Handler<AcceptEvents, Result>,
    ): void => {
      const nodeName = handler.toString().slice(0, 10);
      const inEvents = accept.map((event) => ensureEventName(event.debugLabel));
      const outEvent = ensureEventName(getReturnedEventName(handler));

      graph.addNode(nodeName, {
        type: "handler",
        label: nodeName,
      });

      for (const inEvent of inEvents) {
        graph.mergeNode(inEvent, {
          type: "event",
          label: inEvent,
        });
        graph.addEdge(inEvent, nodeName);
      }
      graph.mergeNode(outEvent, {
        type: "event",
        label: outEvent,
      });
      graph.addEdge(nodeName, outEvent);

      return workflow.handle(accept, handler);
    },
    getGraph: () => graph,
  };
}

function getReturnedEventName<
  AcceptEvents extends AcceptEventsType,
  Result extends ResultType,
>(handler: Handler<AcceptEvents, Result>): string | undefined {
  try {
    const handlerCode = handler.toString();
    const ast = babelParser.parse(handlerCode, {
      sourceType: "module",
    });

    let returnedEventName: string | null = null;

    if (
      ast.program.body[0] &&
      ast.program.body[0].type === "ExpressionStatement"
    ) {
      const funcExpr = ast.program.body[0].expression;
      if (funcExpr && funcExpr.type === "ArrowFunctionExpression") {
        let returnArgNode: Expression | null = null;

        if (funcExpr.body.type === "BlockStatement") {
          for (const stmt of funcExpr.body.body) {
            if (stmt.type === "ReturnStatement" && stmt.argument) {
              returnArgNode = stmt.argument;
              break;
            }
          }
        } else {
          returnArgNode = funcExpr.body;
        }

        if (returnArgNode) {
          if (returnArgNode.type === "Identifier") {
            returnedEventName = returnArgNode.name;
          } else if (
            returnArgNode.type === "CallExpression" &&
            returnArgNode.callee.type === "MemberExpression" &&
            returnArgNode.callee.object.type === "Identifier"
          ) {
            returnedEventName = returnArgNode.callee.object.name;
          }
        }
      }
    }

    if (returnedEventName) {
      return returnedEventName;
    } else {
      console.log(
        "Parser did not identify a clear returned event variable from handler AST.",
      );
      return undefined;
    }
  } catch (e: any) {
    console.error("Error parsing handler code with Babel:", e.message);
    return undefined;
  }
}

function ensureEventName(name: string | undefined): string {
  if (!name) {
    return "unknown";
  }
  return name.endsWith("Event") || name.endsWith("event")
    ? name
    : `${name}Event`;
}
