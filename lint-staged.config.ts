import type { Configuration } from "lint-staged";

export default {
  "*": ["biome check --no-errors-on-unmatched"],
} satisfies Configuration;
