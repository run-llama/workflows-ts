"use server";

import fs from "node:fs/promises";

export async function readFileBlob(path: string): Promise<Blob> {
  const content = await fs.readFile(path);
  return new Blob([new Uint8Array(content)], { type: "application/pdf" });
}
