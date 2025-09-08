import { describe, expect, test } from "vitest";
import * as z3 from "zod/v3";
import * as z4 from "zod/v4";
import { zodEvent } from "../../src/util/zod";

describe("zodEvent", () => {
  test("can use zod schema to infer types and validate", () => {
    const UserSchema = z3.object({
      name: z3.string(),
      age: z3.number(),
    });
    const event = zodEvent(UserSchema);

    const schema = event.schema;
    expect(schema).toBe(UserSchema);

    const validData = { name: "John", age: 30 };
    const invalidData = { name: "John", age: "30" };

    expect(() => event.with(validData)).not.toThrow();
    expect(() => event.with(invalidData as any)).toThrow();
  });

  test("can use zod v4 schema to infer types and validate", () => {
    const UserSchema = z4.object({
      name: z4.string(),
      age: z4.number(),
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
