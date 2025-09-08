import type { Configuration } from "lint-staged";

export default {
	"*": ["biome check --write"],
} satisfies Configuration;
