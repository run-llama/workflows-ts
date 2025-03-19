import { describe, expect, test, vi } from 'vitest'
import { createWorkflow } from '../src/core/create-workflow'
import { workflowEvent, type WorkflowEventData } from '../src/core/event'
import { readableStream } from '../src/core/readable-stream'

describe("create workflow", () => {
  const startEvent = workflowEvent()
  const stopEvent = workflowEvent()
  test("should works with single handler", async () => {
    const workflow = createWorkflow({
      startEvent,
      stopEvent
    })
    const f1 = vi.fn(async () => stopEvent())
    workflow.handle(
      [startEvent],
      f1
    )

    const executor = workflow.run()
    const stream = await readableStream(executor)
    const events: WorkflowEventData<any>[] = []
    for await (const ev of stream) {
      events.push(ev)
    }
    expect(f1).toBeCalledTimes(1)
    expect(events).toHaveLength(2)
  })

  test("should works with multiple handlers", async () => {
    const workflow = createWorkflow({
      startEvent,
      stopEvent
    })
    const event = workflowEvent()
    const f1 =vi.fn(async () => event())
    const f2 = vi.fn(async () => stopEvent())
    workflow.handle(
      [startEvent],
      f1,
    )

    workflow.handle(
      [event],
      f2,
    )
    const executor = workflow.run()
    const stream = await readableStream(executor)
    const events: WorkflowEventData<any>[] = []
    for await (const ev of stream) {
      events.push(ev)
    }
    expect(f1).toBeCalledTimes(1)
    expect(f2).toBeCalledTimes(1)
    expect(events).toHaveLength(3)
  })

  test("should works with multiple handlers (if-else)", async () => {
    const workflow = createWorkflow({
      startEvent,
      stopEvent
    })
    const event1 = workflowEvent<number>()
    const event2 = workflowEvent<number>()
    const f1 = vi.fn(async () => event1(2))
    const f2 = vi.fn(async ({ data }: ReturnType<typeof event1>) => event2(data-1))
    const f3 = vi.fn(async ({ data}: ReturnType<typeof event2>) => data > 0 ? event1(data) : stopEvent())
    workflow.handle(
      [startEvent],
      f1,
    )

    workflow.handle(
      [event1],
      f2,
    )

    workflow.handle(
      [event2],
      f3,
    )
    const executor = workflow.run()
    const stream = await readableStream(executor)
    const events: WorkflowEventData<any>[] = []
    for await (const ev of stream) {
      events.push(ev)
    }
    expect(f1).toBeCalledTimes(1)
    expect(f2).toBeCalledTimes(2)
    expect(f3).toBeCalledTimes(2)
    expect(events).toHaveLength(6)
    console.log('events', events)
  })
})