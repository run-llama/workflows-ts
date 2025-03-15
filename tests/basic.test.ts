import { createWorkflow, workflowEvent, getExecutorContext } from '../src/core'
import { describe, expect, test, beforeEach } from 'vitest'
import { timeoutHandler } from '../src/interrupter/timeout'
import { promiseHandler } from '../src/interrupter/promise'

const startEvent = workflowEvent<string>({
  debugLabel: 'startEvent'
})
const convertEvent = workflowEvent<number>({
  debugLabel: 'convertEvent'
})
const stopEvent = workflowEvent<1 | -1>({
  debugLabel: 'stopEvent'
})

let workflow: ReturnType<typeof createWorkflow<string, 1 | -1>>

beforeEach(() => {
  workflow = createWorkflow<string, 1 | -1>({
    startEvent,
    stopEvent
  })
})

describe('basic', () => {
  // basic test for workflowEvent
  {
    const ev1 = startEvent('1')
    const ev2 = startEvent('2')
    // they are the same type
    expect(ev1.event === ev2.event).toBe(true)
    expect(ev1 !== ev2).toBe(true)
    expect(ev1.data).toBe('1')
    expect(ev2.data).toBe('2')
  }

  test('sync', async () => {
    workflow.handle([startEvent], (start) => {
      return convertEvent(Number.parseInt(start.data, 10))
    })
    workflow.handle([convertEvent], (convert) => {
      return stopEvent(convert.data > 0 ? 1 : -1)
    })

    const result = await promiseHandler(workflow, startEvent('100'))
    expect(result.data).toBe(1)
  })

  test('async', async () => {
    workflow.handle([startEvent], async (start) => {
      return convertEvent(Number.parseInt(start.data, 10))
    })
    workflow.handle([convertEvent], async (convert) => {
      return stopEvent(convert.data > 0 ? 1 : -1)
    })

    const result = await promiseHandler(workflow, startEvent('100'))
    expect(result.data).toBe(1)
  })

  test('async + sync', async () => {
    workflow.handle([startEvent], async (start) => {
      return convertEvent(Number.parseInt(start.data, 10))
    })
    workflow.handle([convertEvent], (convert) => {
      return stopEvent(convert.data > 0 ? 1 : -1)
    })

    const result = await promiseHandler(workflow, startEvent('100'))
    expect(result.data).toBe(1)
  })

  test('async + timeout', async () => {
    workflow.handle([startEvent], async (start) => {
      return convertEvent(Number.parseInt(start.data, 10))
    })
    workflow.handle([convertEvent], async (convert) => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      return stopEvent(convert.data > 0 ? 1 : -1)
    })

    const result = await promiseHandler(workflow, startEvent('100'))
    expect(result.data).toBe(1)
  })
})

describe('condition', () => {
  test('basic', async () => {
    workflow.handle([startEvent], (start) => {
      return start.data === '100' ? stopEvent(1) : stopEvent(-1)
    })

    {
      const result = await promiseHandler(workflow, startEvent('100'))
      expect(result.data).toBe(1)
    }

    {

      const result = await promiseHandler(workflow, startEvent('200'))
      expect(result.data).toBe(-1)
    }
  })
})

describe('multiple inputs', () => {
  test('basic', async () => {
    workflow.handle([startEvent], (start) => {
      const ev1 = convertEvent(Number.parseInt(start.data, 10))
      const ev2 = convertEvent(Number.parseInt(start.data, 10))
      getExecutorContext().sendEvent(ev1)
      return ev2
    })
    workflow.handle([convertEvent, convertEvent], (convert1, convert2) => {
      return stopEvent(convert1.data + convert2.data > 0 ? 1 : -1)
    })

    const result = await promiseHandler(workflow, startEvent('100'))
    expect(result.data).toBe(1)
  })

  test('require events', async () => {
    workflow.handle([startEvent], (start) => {
      for (let i = 0; i < 100; i++) {
        getExecutorContext().
          sendEvent(convertEvent(Number.parseInt(start.data, 10)))
      }
      return
    })
    workflow.handle(Array.from({ length: 100 }).map(() => convertEvent),
      async () => {
        return stopEvent(1)
      }
    )

    const result = await promiseHandler(workflow, startEvent('100'))
    expect(result.data).toBe(1)
  })

  test('require events with timeout', async () => {
    workflow.handle([startEvent], async (start) => {
      for (let i = 0; i < 100; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1))
        getExecutorContext().
          sendEvent(convertEvent(Number.parseInt(start.data, 10)))
      }
    })

    workflow.handle(Array.from({ length: 100 }).map(() => convertEvent),
      async () => {
        return stopEvent(1)
      }
    )

    const result = await promiseHandler(workflow, startEvent('100'))
    expect(result.data).toBe(1)
  })

  test.fails('require events with no await', async () => {
    workflow.handle([startEvent], async (start) => {
      for (let i = 0; i < 100; i++) {
        // it's not possible to detect if/when the event is sent
        setTimeout(() => {
          getExecutorContext().
            sendEvent(convertEvent(Number.parseInt(start.data, 10)))
        }, 10)
      }
    })

    workflow.handle(Array.from({ length: 100 }).map(() => convertEvent),
      async () => {
        return stopEvent(1)
      }
    )

    const result = await promiseHandler(workflow, startEvent('100'))
    expect(result.data).toBe(1)
  })

  test('require events with no await in handler', async () => {
    workflow.handle([startEvent], async (start) => {
      for (let i = 0; i < 100; i++) {
        // it's not possible to detect if/when the event is sent
        setTimeout(() => {
          getExecutorContext().
            sendEvent(convertEvent(Number.parseInt(start.data, 10)))
        }, 10)
      }
    })

    workflow.handle(Array.from({ length: 100 }).map(() => convertEvent),
      async () => {
        return stopEvent(1)
      }
    )

    const result = await timeoutHandler(workflow, startEvent('100'))
    expect(result.data).toBe(1)
  })
})
