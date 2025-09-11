import { NextResponse } from "next/server";
import { runWorkflow } from "@/utils/ai-workflow";

export async function POST(req: Request) {
  const { query } = await req.json();
  const result = await runWorkflow(query);
  const { outputPath, refusal } = result;
  return NextResponse.json({ outputPath: outputPath, refusal: refusal });
}
