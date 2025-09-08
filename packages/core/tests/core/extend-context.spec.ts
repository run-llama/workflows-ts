import {
  createWorkflow,
  extendContext,
  type InheritanceTransformer,
  type WorkflowContext,
  workflowEvent,
} from "@llamaindex/workflow-core";
import { describe, expect, test, vi } from "vitest";

const startEvent = workflowEvent({
  debugLabel: "start",
});

const stopEvent = workflowEvent({
  debugLabel: "stop",
});

describe("extendContext", () => {
  test("should add simple properties to context", () => {
    const workflow = createWorkflow();
    const context = workflow.createContext();

    const testProperty = "test-value";
    const testFunction = vi.fn();

    extendContext(context, {
      testProperty,
      testFunction,
    });

    expect((context as any).testProperty).toBe(testProperty);
    expect((context as any).testFunction).toBe(testFunction);
  });

  test("should apply inheritance transformers to root context immediately", () => {
    const workflow = createWorkflow();
    const context = workflow.createContext();

    const originalValue = "original";
    const transformedValue = "transformed";

    // Add a property first
    extendContext(context, {
      testProperty: originalValue,
    });

    // Then add a transformer for that property
    const transformer: InheritanceTransformer = vi.fn(
      (_handlerContext, originalDescriptor) => ({
        ...originalDescriptor,
        value: transformedValue,
      }),
    );

    extendContext(
      context,
      {},
      {
        testProperty: transformer,
      },
    );

    expect(transformer).toHaveBeenCalledWith(context, expect.any(Object));
    expect((context as any).testProperty).toBe(transformedValue);
  });

  test("should handle getter properties with transformers", () => {
    const workflow = createWorkflow();
    const context = workflow.createContext();

    // Add a getter property
    Object.defineProperty(context, "dynamicProperty", {
      get() {
        return "dynamic-value";
      },
      configurable: true,
      enumerable: true,
    });

    const transformer: InheritanceTransformer = (
      handlerContext,
      originalDescriptor,
    ) => ({
      ...originalDescriptor,
      get() {
        const original = originalDescriptor.get?.call(handlerContext);
        return `transformed-${original}`;
      },
    });

    extendContext(
      context,
      {},
      {
        dynamicProperty: transformer,
      },
    );

    expect((context as any).dynamicProperty).toBe("transformed-dynamic-value");
  });

  test("should handle multiple inheritance transformers", () => {
    const workflow = createWorkflow();
    const context = workflow.createContext();

    extendContext(context, {
      prop1: "value1",
      prop2: "value2",
      prop3: "value3",
    });

    const transformer1: InheritanceTransformer = (_, originalDescriptor) => ({
      ...originalDescriptor,
      value: `transformed-${originalDescriptor.value}`,
    });

    const transformer2: InheritanceTransformer = (_, originalDescriptor) => ({
      ...originalDescriptor,
      value: `${originalDescriptor.value}-extra`,
    });

    extendContext(
      context,
      {},
      {
        prop1: transformer1,
        prop2: transformer2,
      },
    );

    expect((context as any).prop1).toBe("transformed-value1");
    expect((context as any).prop2).toBe("value2-extra");
    expect((context as any).prop3).toBe("value3"); // No transformer, unchanged
  });

  test("should handle lazy initialization in transformers", () => {
    const workflow = createWorkflow();
    const context = workflow.createContext();
    const initCalls: string[] = [];

    Object.defineProperty(context, "lazyProperty", {
      get() {
        initCalls.push("root");
        return "root-value";
      },
      configurable: true,
      enumerable: true,
    });

    const transformer: InheritanceTransformer = (
      handlerContext,
      originalDescriptor,
    ) => {
      let lazyValue: any = null;
      return {
        ...originalDescriptor,
        get() {
          if (lazyValue === null) {
            initCalls.push("handler");
            const original = originalDescriptor.get?.call(handlerContext);
            lazyValue = `lazy-${original}`;
          }
          return lazyValue;
        },
      };
    };

    extendContext(
      context,
      {},
      {
        lazyProperty: transformer,
      },
    );

    const value = (context as any).lazyProperty;
    expect(value).toBe("lazy-root-value");
    expect(initCalls).toEqual(["handler", "root"]);

    // Second access should use cached value
    const value2 = (context as any).lazyProperty;
    expect(value2).toBe("lazy-root-value");
    expect(initCalls).toEqual(["handler", "root"]); // No additional calls
  });

  test("should not apply transformers for non-existent properties", () => {
    const workflow = createWorkflow();
    const context = workflow.createContext();

    const transformer = vi.fn();

    extendContext(
      context,
      {},
      {
        nonExistentProperty: transformer,
      },
    );

    expect(transformer).not.toHaveBeenCalled();
  });

  test("should work with multiple extendContext calls", () => {
    const workflow = createWorkflow();
    const context = workflow.createContext();

    // First call
    extendContext(context, {
      prop1: "value1",
    });

    // Second call
    extendContext(context, {
      prop2: "value2",
    });

    // Third call with transformer
    extendContext(context, {
      prop3: "value3",
    });

    const transformer: InheritanceTransformer = (_, originalDescriptor) => ({
      ...originalDescriptor,
      value: `transformed-${originalDescriptor.value}`,
    });

    extendContext(
      context,
      {},
      {
        prop3: transformer,
      },
    );

    expect((context as any).prop1).toBe("value1");
    expect((context as any).prop2).toBe("value2");
    expect((context as any).prop3).toBe("transformed-value3");
  });

  test("should preserve original property descriptor properties", () => {
    const workflow = createWorkflow();
    const context = workflow.createContext();

    Object.defineProperty(context, "testProperty", {
      value: "test",
      writable: false,
      enumerable: false,
      configurable: true,
    });

    const transformer: InheritanceTransformer = (_, originalDescriptor) => ({
      ...originalDescriptor,
      value: "transformed",
    });

    extendContext(
      context,
      {},
      {
        testProperty: transformer,
      },
    );

    const descriptor = Object.getOwnPropertyDescriptor(context, "testProperty");
    expect(descriptor?.value).toBe("transformed");
    expect(descriptor?.writable).toBe(false);
    expect(descriptor?.enumerable).toBe(false);
    expect(descriptor?.configurable).toBe(true);
  });

  test("should handle inheritance transformers when property descriptors change", () => {
    const workflow = createWorkflow();
    const context = workflow.createContext();

    // Test that the transformer is called with the latest descriptor
    extendContext(context, {
      changingProperty: "initial",
    });

    // Change the property descriptor
    Object.defineProperty(context, "changingProperty", {
      get() {
        return "getter-value";
      },
      configurable: true,
      enumerable: true,
    });

    const transformer: InheritanceTransformer = (_, originalDescriptor) => {
      if (originalDescriptor.get) {
        return {
          ...originalDescriptor,
          get() {
            return `transformed-${originalDescriptor.get?.call(this)}`;
          },
        };
      }
      return {
        ...originalDescriptor,
        value: `transformed-${originalDescriptor.value}`,
      };
    };

    extendContext(
      context,
      {},
      {
        changingProperty: transformer,
      },
    );

    expect((context as any).changingProperty).toBe("transformed-getter-value");
  });

  test("should handle transformer that returns identical descriptor", () => {
    const workflow = createWorkflow();
    const context = workflow.createContext();

    extendContext(context, {
      testProperty: "original-value",
    });

    const transformer: InheritanceTransformer = (_, originalDescriptor) => {
      // Return the same descriptor without modifications
      return originalDescriptor;
    };

    extendContext(
      context,
      {},
      {
        testProperty: transformer,
      },
    );

    expect((context as any).testProperty).toBe("original-value");
  });

  test("should handle concurrent property inheritance handlers map", () => {
    const workflow = createWorkflow();
    const context = workflow.createContext();

    extendContext(context, {
      prop1: "value1",
      prop2: "value2",
    });

    const transformer1: InheritanceTransformer = (_, originalDescriptor) => ({
      ...originalDescriptor,
      value: `t1-${originalDescriptor.value}`,
    });

    const transformer2: InheritanceTransformer = (_, originalDescriptor) => ({
      ...originalDescriptor,
      value: `t2-${originalDescriptor.value}`,
    });

    // Add transformers in separate calls
    extendContext(context, {}, { prop1: transformer1 });
    extendContext(context, {}, { prop2: transformer2 });

    expect((context as any).prop1).toBe("t1-value1");
    expect((context as any).prop2).toBe("t2-value2");

    // Verify internal map has both transformers
    const internalMap = (context as any)
      .__internal__property_inheritance_handlers;
    expect(internalMap).toBeInstanceOf(Map);
    expect(internalMap.size).toBe(2);
    expect(internalMap.has("prop1")).toBe(true);
    expect(internalMap.has("prop2")).toBe(true);
  });

  test("should allow simple properties to inherit via prototype chain in handlers", async () => {
    const workflow = createWorkflow();
    let handlerContext: WorkflowContext | null = null;

    workflow.handle([startEvent], (context) => {
      handlerContext = context;
      return stopEvent.with();
    });

    const context = workflow.createContext();
    const testValue = "inherited-value";

    extendContext(context, {
      testProperty: testValue,
    });

    context.sendEvent(startEvent.with());

    // Wait for handler to execute
    await new Promise<void>((resolve) => {
      const checkHandler = () => {
        if (handlerContext) {
          resolve();
        } else {
          setTimeout(checkHandler, 10);
        }
      };
      checkHandler();
    });

    expect(handlerContext).toBeTruthy();
    expect((handlerContext as any).testProperty).toBe(testValue);
  });

  test("should apply inheritance transformers to handler contexts", async () => {
    const workflow = createWorkflow();
    let handlerContext: WorkflowContext | null = null;
    let transformedValue: string | null = null;

    workflow.handle([startEvent], (context) => {
      handlerContext = context;
      transformedValue = (handlerContext as any).testProperty;
      return stopEvent.with();
    });

    const context = workflow.createContext();

    extendContext(context, {
      testProperty: "original",
    });

    const transformer: InheritanceTransformer = (
      _handlerContext,
      originalDescriptor,
    ) => ({
      ...originalDescriptor,
      value: `transformed-${originalDescriptor.value}`,
    });

    extendContext(
      context,
      {},
      {
        testProperty: transformer,
      },
    );

    context.sendEvent(startEvent.with());

    // Wait for handler to execute
    await new Promise<void>((resolve) => {
      const checkHandler = () => {
        if (handlerContext && transformedValue !== null) {
          resolve();
        } else {
          setTimeout(checkHandler, 10);
        }
      };
      checkHandler();
    });

    expect(handlerContext).toBeTruthy();
    expect(transformedValue).toBe("transformed-original");
  });
});
