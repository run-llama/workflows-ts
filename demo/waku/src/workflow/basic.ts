import { neon } from "@neondatabase/serverless";
import { createWorkflow, getContext } from "@llamaindex/workflow-core";
import { storeEvent, stopEvent, searchEvent } from "./events";
import { getEnv } from "waku";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: getEnv("OPENAI_API_KEY")!,
});
const sql = neon(getEnv("DATABASE_URL")!);

export const workflow = createWorkflow();

workflow.handle([storeEvent], async ({ data }) => {
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: data,
  });
  const embedding = embeddingResponse.data[0]!.embedding;
  await sql`
      INSERT INTO text_vectors (text, embedding)
      VALUES (${data}, ${JSON.stringify(embedding)})
  `;
  return stopEvent.with("success");
});

workflow.handle([searchEvent], async ({ data }) => {
  const { signal } = getContext();
  signal.addEventListener("abort", () => {
    console.error("error", signal.reason);
  });
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: data,
  });
  const embedding = embeddingResponse.data[0]!.embedding;
  const result = await sql`
      SELECT text
      FROM text_vectors
      ORDER BY embedding <=> ${JSON.stringify(embedding)}
      LIMIT 5
  `;
  return stopEvent.with(result.map((row) => row.text).join("\n"));
});
