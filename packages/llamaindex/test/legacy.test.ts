import { beforeEach, describe, expect, test, vi, type Mocked } from "vitest";
import type { StepContext } from "../src";
import { StartEvent, StopEvent, Workflow, WorkflowEvent } from "../src";

class JokeEvent extends WorkflowEvent<{ joke: string }> {}

class AnalysisEvent extends WorkflowEvent<{ analysis: string }> {}

describe("workflow basic", () => {
  let generateJoke: Mocked<
    (context: StepContext, ev: StartEvent) => Promise<JokeEvent>
  >;
  let critiqueJoke: Mocked<
    (context: StepContext, ev: JokeEvent) => Promise<StopEvent<string>>
  >;

  beforeEach(() => {
    generateJoke = vi.fn(async (_context, _: StartEvent) => {
      return new JokeEvent({ joke: "a joke" });
    });

    critiqueJoke = vi.fn(async (_context, _: JokeEvent) => {
      return new StopEvent("stop");
    });
  });

  test("workflow basic", async () => {
    const workflow = new Workflow<
      {
        foo: string;
        bar: number;
      },
      string,
      string
    >();
    workflow.addStep(
      {
        inputs: [StartEvent],
      },
      async ({ data }, start) => {
        expect(start).toBeInstanceOf(StartEvent);
        expect(start.data).toBe("start");
        expect(data.bar).toBe(42);
        expect(data.foo).toBe("foo");
        return new StopEvent("stopped");
      },
    );

    const result = workflow.run("start", {
      foo: "foo",
      bar: 42,
    });
    await result;
  });

  test("run workflow", async () => {
    const jokeFlow = new Workflow<unknown, string, string>();

    jokeFlow.addStep({ inputs: [StartEvent<string>] }, generateJoke);
    jokeFlow.addStep({ inputs: [JokeEvent] }, critiqueJoke);

    const result = await jokeFlow.run("pirates");

    expect(generateJoke).toHaveBeenCalledTimes(1);
    expect(critiqueJoke).toHaveBeenCalledTimes(1);
    expect(result.data).toBe("stop");
  });

  test("run workflow with multiple in-degree", async () => {
    const jokeFlow = new Workflow<unknown, string, string>();

    jokeFlow.addStep(
      {
        inputs: [StartEvent],
      },
      async (context, _) => {
        context.sendEvent(
          new AnalysisEvent({
            analysis: "an analysis",
          }),
        );
        return new JokeEvent({
          joke: "a joke",
        });
      },
    );
    jokeFlow.addStep(
      {
        inputs: [JokeEvent, AnalysisEvent],
      },
      async () => {
        return new StopEvent("The analysis is insightful and helpful.");
      },
    );

    const result = await jokeFlow.run("pirates");
    expect(result.data).toBe("The analysis is insightful and helpful.");
  });

  test("run workflow with object-based StartEvent and StopEvent", async () => {
    const objectFlow = new Workflow<
      unknown,
      Person,
      {
        result: {
          greeting: string;
        };
      }
    >();

    type Person = { name: string; age: number };

    const processObject = vi.fn(async (_context, ev: StartEvent<Person>) => {
      const { name, age } = ev.data;
      return new StopEvent({
        result: { greeting: `Hello ${name}, you are ${age} years old!` },
      });
    });

    objectFlow.addStep(
      {
        inputs: [StartEvent<Person>],
      },
      processObject,
    );

    const result = await objectFlow.run({ name: "Alice", age: 30 });

    expect(processObject).toHaveBeenCalledTimes(1);
    expect(result.data.result).toEqual({
      greeting: "Hello Alice, you are 30 years old!",
    });
  });

  test("workflow with two concurrent steps", async () => {
    const concurrentFlow = new Workflow<unknown, string, string>();

    const step1 = vi.fn(async (_context, _ev: StartEvent) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return new StopEvent("Step 1 completed");
    });

    const step2 = vi.fn(async (_context, _ev: StartEvent) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return new StopEvent("Step 2 completed");
    });

    concurrentFlow.addStep(
      {
        inputs: [StartEvent<string>],
      },
      step1,
    );
    concurrentFlow.addStep(
      {
        inputs: [StartEvent<string>],
      },
      step2,
    );

    const startTime = new Date();
    const result = await concurrentFlow.run("start");
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    expect(step1).toHaveBeenCalledTimes(1);
    expect(step2).toHaveBeenCalledTimes(1);
    expect(duration).toBeLessThan(200);
    expect(result.data).toBe("Step 2 completed");
  });

  test("sendEvent", async () => {
    const myWorkflow = new Workflow<unknown, string, string>();

    class QueryEvent extends WorkflowEvent<{ query: string }> {}

    class QueryResultEvent extends WorkflowEvent<{ result: string }> {}

    class PendingEvent extends WorkflowEvent<void> {}

    myWorkflow.addStep(
      {
        inputs: [StartEvent],
      },
      async (context: StepContext, events) => {
        context.sendEvent(new QueryEvent({ query: "something" }));
        return new PendingEvent();
      },
    );

    myWorkflow.addStep(
      {
        inputs: [QueryEvent],
      },
      async (context, event) => {
        return new QueryResultEvent({ result: "query result" });
      },
    );

    myWorkflow.addStep(
      {
        inputs: [PendingEvent, QueryResultEvent],
      },
      async (context, ev0, ev1) => {
        return new StopEvent(ev1.data.result);
      },
    );

    const result = await myWorkflow.run("start");
    expect(result.data).toBe("query result");
  });

  test("allow output with send event", async () => {
    const myFlow = new Workflow<unknown, string, string>();
    myFlow.addStep(
      {
        inputs: [StartEvent<string>],
      },
      async (context, ev) => {
        context.sendEvent(new StopEvent(`Hello ${ev.data}!`));
      },
    );
    const result = await myFlow.run("world");
    expect(result.data).toBe("Hello world!");
  });
});

describe("workflow event loop", () => {
  test("basic", async () => {
    const jokeFlow = new Workflow<unknown, string, string>();

    jokeFlow.addStep(
      {
        inputs: [StartEvent<string>],
      },
      async (_context, ev: StartEvent) => {
        return new StopEvent(`Hello ${ev.data}!`);
      },
    );

    const result = await jokeFlow.run("world");
    expect(result.data).toBe("Hello world!");
  });

  test("branch", async () => {
    const myFlow = new Workflow<unknown, string, string>();

    class BranchA1Event extends WorkflowEvent<{ payload: string }> {}

    class BranchA2Event extends WorkflowEvent<{ payload: string }> {}

    class BranchB1Event extends WorkflowEvent<{ payload: string }> {}

    class BranchB2Event extends WorkflowEvent<{ payload: string }> {}

    let control = false;

    myFlow.addStep(
      {
        inputs: [StartEvent<string>],
      },
      async (_context, ev) => {
        if (control) {
          return new BranchA1Event({ payload: ev.data });
        } else {
          return new BranchB1Event({ payload: ev.data });
        }
      },
    );

    myFlow.addStep(
      {
        inputs: [BranchA1Event],
      },
      async (_context, ev) => {
        return new BranchA2Event({ payload: ev.data.payload });
      },
    );

    myFlow.addStep(
      {
        inputs: [BranchB1Event],
      },
      async (_context, ev) => {
        return new BranchB2Event({ payload: ev.data.payload });
      },
    );

    myFlow.addStep(
      {
        inputs: [BranchA2Event],
      },
      async (_context, ev) => {
        return new StopEvent(`Branch A2: ${ev.data.payload}`);
      },
    );

    myFlow.addStep(
      {
        inputs: [BranchB2Event],
      },
      async (_context, ev) => {
        return new StopEvent(`Branch B2: ${ev.data.payload}`);
      },
    );

    {
      const result = await myFlow.run("world");
      expect(result.data).toMatch(/Branch B2: world/);
    }

    control = true;

    {
      const result = await myFlow.run("world");
      expect(result.data).toMatch(/Branch A2: world/);
    }

    {
      const context = myFlow.run("world");
      for await (const event of context) {
        if (event instanceof BranchA2Event) {
          expect(event.data.payload).toBe("world");
        }
        if (event instanceof StopEvent) {
          expect(event.data).toMatch(/Branch A2: world/);
        }
      }
    }
  });

  test("one event have multiple outputs", async () => {
    const myFlow = new Workflow<unknown, string, string>();

    class AEvent extends WorkflowEvent<{ payload: string }> {}

    class BEvent extends WorkflowEvent<{ payload: string }> {}

    class CEvent extends WorkflowEvent<{ payload: string }> {}

    class DEvent extends WorkflowEvent<{ payload: string }> {}

    myFlow.addStep(
      {
        inputs: [StartEvent<string>],
      },
      async (_context, ev) => {
        return new StopEvent("STOP");
      },
    );

    const fn = vi.fn(async (_context, ev: StartEvent) => {
      return new AEvent({ payload: ev.data });
    });

    myFlow.addStep(
      {
        inputs: [StartEvent<string>],
      },
      fn,
    );
    myFlow.addStep(
      {
        inputs: [AEvent],
      },
      async (_context, ev: AEvent) => {
        return new BEvent({ payload: ev.data.payload });
      },
    );
    myFlow.addStep(
      {
        inputs: [AEvent],
      },
      async (_context, ev: AEvent) => {
        return new CEvent({ payload: ev.data.payload });
      },
    );
    myFlow.addStep(
      {
        inputs: [BEvent],
      },
      async (_context, ev: BEvent) => {
        return new DEvent({ payload: ev.data.payload });
      },
    );
    myFlow.addStep(
      {
        inputs: [CEvent],
      },
      async (_context, ev: CEvent) => {
        return new DEvent({ payload: ev.data.payload });
      },
    );
    myFlow.addStep(
      {
        inputs: [DEvent],
      },
      async (_context, ev: DEvent) => {
        return new StopEvent(`Hello ${ev.data.payload}!`);
      },
    );

    const result = await myFlow.run("world");
    expect(result.data).toBe("STOP");
    expect(fn).toHaveBeenCalledTimes(1);

    // streaming events will allow to consume event even stop event is reached
    const stream = myFlow.run("world");
    for await (const _ of stream) {
      /* empty */
    }
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("run with custom context", async () => {
    type MyContext = { name: string };
    const myFlow = new Workflow<MyContext, string, string>();
    myFlow.addStep(
      {
        inputs: [StartEvent<string>],
      },
      async ({ data }, _: StartEvent) => {
        return new StopEvent(`Hello ${data.name}!`);
      },
    );

    const result = await myFlow.run("world", { name: "Alice" });
    expect(result.data).toBe("Hello Alice!");
  });

  test("run and get context", async () => {
    type MyContext = { name: string };
    const myFlow = new Workflow<MyContext, string, string>();
    myFlow.addStep(
      {
        inputs: [StartEvent<string>],
      },
      async ({ data }, _: StartEvent) => {
        return new StopEvent(`Hello ${data.name}!`);
      },
    );

    const context = myFlow.run("world", { name: "Alice" });
    expect((await context).data).toBe("Hello Alice!");
    expect(context.data.name).toBe("Alice");
  });
});
