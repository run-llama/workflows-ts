import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

type ReportContent = {
  reportContent: string;
  reportTitle: string | null;
};

const QueryApprove = z.object({
  isNewsRelatedQuery: z.boolean(),
  enhancedQuery: z.string(),
});

const Report = z.object({
  reportTitle: z.string(),
  reportContent: z.string(),
});

export async function webSearch(textInput: string): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
  const response = await client.responses.create({
    model: "gpt-4.1",
    tools: [{ type: "web_search" }],
    input: textInput,
  });

  return response.output_text;
}

export async function evaluateQueryAndEnhance(text: string): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
  const response = await client.responses.parse({
    model: "gpt-4.1",
    input: [
      {
        role: "system",
        content:
          "Please evaluate the query by the user, identifying whether or not it is related to searching the news, and, if so, produce an enhanced query. If the user's query is not related to news, leave the enhanced query simply as an empty string.",
      },
      { role: "user", content: "Evaluate the following query: '" + text + "'" },
    ],
    text: {
      format: zodTextFormat(QueryApprove, "query_approve"),
    },
  });

  const approvedQuery = response.output_parsed;
  if (approvedQuery) {
    if (approvedQuery.isNewsRelatedQuery) {
      return approvedQuery.enhancedQuery;
    } else {
      return "Sorry, what you are asking is not news-related, so I cannot produce a report for you.";
    }
  } else {
    return "Sorry, it was not possible to process your request at this time: try again soon!";
  }
}

export async function createReport(
  webSearchText: string,
): Promise<ReportContent> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
  const response = await client.responses.parse({
    model: "gpt-4.1",
    input: [
      {
        role: "system",
        content:
          "Generate the title and the content for a report based on the news search results.",
      },
      {
        role: "user",
        content: "Evaluate the following query: '" + webSearchText + "'",
      },
    ],
    text: {
      format: zodTextFormat(Report, "report"),
    },
  });

  const generatedReport = response.output_parsed;
  if (generatedReport) {
    return {
      reportContent:
        "# " +
        generatedReport.reportTitle +
        "\n\n" +
        generatedReport.reportContent,
      reportTitle: generatedReport.reportTitle,
    } as ReportContent;
  } else {
    return {
      reportContent:
        "Sorry, it was not possible to generate a report for you at this time, try again later!",
      reportTitle: null,
    } as ReportContent;
  }
}
