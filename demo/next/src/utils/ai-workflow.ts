"use server";

import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import {
  createReport,
  webSearch,
  evaluateQueryAndEnhance,
} from "./openai-utils";
import { convertMdToPdf } from "./pdf-conversion";

type WorkflowOutput = {
  output_path: string | null;
  refusal: string | null;
};

const userInputEvent = workflowEvent<{
  text: string;
}>();
const webSearchEvent = workflowEvent<{
  query: string;
}>();
const createReportEvent = workflowEvent<{
  content: string;
}>();
const finalResponseEvent = workflowEvent<{
  output_path: string | null;
  refusal: string | null;
}>();

const workflow = createWorkflow();

workflow.handle([userInputEvent], async (context, { data }) => {
  const { sendEvent } = context;
  const { text } = data;
  const enhancedQuery = await evaluateQueryAndEnhance(text);
  if (
    enhancedQuery.startsWith(
      "Sorry, what you are asking is not news-related,",
    ) ||
    enhancedQuery.startsWith(
      "Sorry, it was not possible to process your request at this time:",
    )
  ) {
    sendEvent(
      finalResponseEvent.with({ output_path: null, refusal: enhancedQuery }),
    );
  } else {
    sendEvent(webSearchEvent.with({ query: enhancedQuery }));
  }
});
workflow.handle([webSearchEvent], async (context, { data }) => {
  const { sendEvent } = context;
  const { query } = data;
  const webSearchContent = await webSearch(query);
  sendEvent(createReportEvent.with({ content: webSearchContent }));
});
workflow.handle([createReportEvent], async (context, { data }) => {
  const { sendEvent } = context;
  const { content } = data;
  const reportContent = await createReport(content);
  if (reportContent.report_title) {
    const out_path = await convertMdToPdf(
      reportContent.report_content,
      reportContent.report_title,
    );
    if (out_path.startsWith("Impossible to convert ")) {
      sendEvent(
        finalResponseEvent.with({ output_path: null, refusal: out_path }),
      );
    } else {
      sendEvent(
        finalResponseEvent.with({ output_path: out_path, refusal: null }),
      );
    }
  } else {
    sendEvent(
      finalResponseEvent.with({
        output_path: null,
        refusal: reportContent.report_content,
      }),
    );
  }
});

export async function runWorkflow(text: string): Promise<WorkflowOutput> {
  const { stream, sendEvent } = workflow.createContext();

  sendEvent(
    userInputEvent.with({
      text: text,
    }),
  );

  const result = await stream.until(finalResponseEvent).toArray();
  return result[result.length - 1].data as WorkflowOutput;
}
