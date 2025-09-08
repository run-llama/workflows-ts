import type { Configuration } from "lint-staged";

export default {
  "*": ["biome format"],
} satisfies Configuration;
