import * as babelParser from "@babel/parser";
import { type Expression } from "@babel/types";
import type { Handler } from "@llama-flow/core";
import type { AcceptEventsType, ResultType } from "./types";

export function getReturnedEventName<
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

export function getSentEventNames<
  AcceptEvents extends AcceptEventsType,
  Result extends ResultType,
>(handler: Handler<AcceptEvents, Result>): string[] {
  try {
    const handlerCode = handler.toString();
    const ast = babelParser.parse(handlerCode, {
      sourceType: "module",
    });

    const sentEventNames = new Set<string>();

    const visit = (node: any) => {
      if (!node) {
        return;
      }

      if (node.type === "CallExpression") {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "sendEvent"
        ) {
          if (node.arguments.length > 0) {
            const firstArg = node.arguments[0];
            if (firstArg.type === "Identifier") {
              sentEventNames.add(firstArg.name);
            } else if (
              firstArg.type === "CallExpression" &&
              firstArg.callee.type === "MemberExpression" &&
              firstArg.callee.object.type === "Identifier"
            ) {
              // Handle cases like sendEvent(branchAEvent.with("Branch A"))
              sentEventNames.add(firstArg.callee.object.name);
            }
          }
        }
      }

      // Recursively visit child nodes
      for (const key in node) {
        if (node.hasOwnProperty(key)) {
          const child = node[key];
          if (typeof child === "object" && child !== null) {
            if (Array.isArray(child)) {
              child.forEach(visit);
            } else {
              visit(child);
            }
          }
        }
      }
    };

    visit(ast);

    if (sentEventNames.size > 0) {
      return Array.from(sentEventNames);
    } else {
      console.log(
        "Parser did not identify any calls to sendEvent with identifiable event names.",
      );
      return [];
    }
  } catch (e: any) {
    console.error("Error parsing handler code with Babel:", e.message);
    return [];
  }
}
