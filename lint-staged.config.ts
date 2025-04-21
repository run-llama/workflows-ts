import type { Configuration } from "lint-staged";

export default {
  "*.{js,jsx,ts,tsx}": ["prettier --write"],
  "*.{json,md,yml}": ["prettier --write"],
} satisfies Configuration;
