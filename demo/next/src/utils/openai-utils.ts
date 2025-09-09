import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

type ReportContent = {
    report_content: string
    report_title: string | null
}

const client = new OpenAI(
    {
        apiKey: process.env.OPENAI_API_KEY!,
    }
);

const QueryApprove = z.object({
  is_news_related_query: z.boolean(),
  enhanched_query: z.string(),
});

const Report = z.object({
    report_title: z.string(),
    report_content: z.string(),
})

export async function webSearch(textInput: string): Promise<string> {
    const response = await client.responses.create({
        model: "gpt-4.1",
        tools: [
            { type: "web_search" },
        ],
        input: textInput,
    });

    return response.output_text;
}

export async function evaluateQueryAndEnhance(text: string): Promise<string> {
  const completion = await client.chat.completions.parse({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content:
          "Please evaluate the query by the user, identifying whether or not it is related to searching the news, and, if so, produce an enhanced query. If the user's query is not related to news, leave the enhanced query simply as an empty string.",
      },
      { role: "user", content: "Evaluate the following query: '"+text+"'" },
    ],
    response_format: zodResponseFormat(QueryApprove, "query_approve"),
  });

  const approvedQuery = completion.choices[0].message.parsed;
  if (approvedQuery) {
    if (approvedQuery.is_news_related_query) {
        return approvedQuery.enhanched_query
    } else {
        return "Sorry, what you are asking is not news-related, so I cannot produce a report for you."
    }
  } else {
    return "Sorry, it was not possible to process your request at this time: try again soon!"
  }
}

export async function createReport(webSearchText: string): Promise<ReportContent> {
    const completion = await client.chat.completions.parse({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content:
          "Generate the title and the content for a report based on the news search results.",
      },
      { role: "user", content: "Evaluate the following query: '"+ webSearchText +"'" },
    ],
    response_format: zodResponseFormat(Report, "report"),
  });

  const generatedReport = completion.choices[0].message.parsed;
  if (generatedReport) {
    return {
        report_content: "# " + generatedReport.report_title + "\n\n" + generatedReport.report_content, 
        report_title: generatedReport.report_title
    } as ReportContent
  } else {
    return {
        report_content: "Sorry, it was not possible to generate a report for you at this time, try again later!",
        report_title: null,
    } as ReportContent
  }
}