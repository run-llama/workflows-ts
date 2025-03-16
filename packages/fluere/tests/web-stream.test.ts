import { describe, expect, test } from "vitest";

describe("readable stream", () => {
  test("basic", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue("hello");
        controller.close();
      },
    });
    for await (const chunk of stream) {
      expect(chunk).toBe("hello");
    }
  });

  test("", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue("hello");
        controller.close();
      },
    });
    for await (const chunk of stream) {
      expect(chunk).toBe("hello");
    }
  });
});
