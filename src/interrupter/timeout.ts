import type {
  Workflow,
  WorkflowEventInstance
} from '../core'

export async function timeoutHandler<Start, Stop> (
  workflow: Workflow<Start, Stop>,
  startEvent: WorkflowEventInstance<Start>,
  timeout: number = 1000
): Promise<WorkflowEventInstance<Stop>> {
  const executor = workflow.run(startEvent, {
    beforeDone: async () => new Promise<void>(
      resolve => setTimeout(resolve, timeout))
  })
  for await (const event of executor) {
    if (event.event === workflow.stopEvent) {
      return event as WorkflowEventInstance<Stop>
    }
  }
  throw new Error('Invalid state')
}