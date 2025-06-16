import { describe, expect, test } from "vitest";
import { z } from "zod";
import { zodEvent } from "../../src/util/zod";

describe("zodEvent", () => {
  test("can use zod schema to infer types and validate", () => {
    const UserSchema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const event = zodEvent(UserSchema);

    const schema = event.schema;
    expect(schema).toBe(UserSchema);

    const validData = { name: "John", age: 30 };
    const invalidData = { name: "John", age: "30" };

    expect(() => event.with(validData)).not.toThrow();
    expect(() => event.with(invalidData as any)).toThrow();
  });
});
