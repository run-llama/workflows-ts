#!/usr/bin/env node

import { execSync } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { addFrontmatter } from "./add-frontmatter.js";

const DOCS_DIR = "./docs/workflows/api-reference";

async function buildApiDocs() {
  console.log("🚀 Building API documentation...");

  try {
    // Clean existing API docs
    console.log("🧹 Cleaning existing API docs...");
    try {
      await fs.rm(DOCS_DIR, { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist, that's ok
    }

    // Generate docs
    console.log("📝 Generating TypeDoc documentation...");
    execSync("pnpm --filter=@llamaindex/workflow-core run build:docs", {
      stdio: "inherit",
    });

    // Add frontmatter to all generated files
    console.log("🎨 Adding frontmatter headers...");
    await addFrontmatter();

    // Ensure meta.json exists
    console.log("📋 Setting up navigation metadata...");
    const metaPath = path.join(DOCS_DIR, "meta.json");
    const metaExists = await fs
      .access(metaPath)
      .then(() => true)
      .catch(() => false);

    if (!metaExists) {
      const metaContent = {
        title: "API Reference",
        description: "Complete API documentation for @llamaindex/workflow-core",
      };
      await fs.writeFile(metaPath, JSON.stringify(metaContent, null, 2));
    }

    // Remove generated README.mdx
    await fs.rm(path.join(DOCS_DIR, "README.mdx"));

    console.log("✅ API documentation built successfully!");
    console.log(`📁 Output location: ${DOCS_DIR}`);
    console.log("🎯 All files now include proper frontmatter headers");
  } catch (error) {
    console.error("❌ Error building API docs:", error.message);
    process.exit(1);
  }
}

buildApiDocs();
