import { NextResponse } from "next/server";
import { readFileBlob } from "@/utils/download-file";

export async function POST(req: Request) {
  const { path } = await req.json();
  const result = await readFileBlob(path);
  // Convert blob to buffer for NextResponse
  const buffer = Buffer.from(await result.arrayBuffer());

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": result.type || "application/octet-stream",
      "Content-Length": result.size.toString(),
    },
  });
}
