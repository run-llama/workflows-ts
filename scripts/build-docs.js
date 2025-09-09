#!/usr/bin/env node

import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { addFrontmatter } from "./add-frontmatter.js";

const DOCS_DIR = "./docs/workflows/api-reference";

/**
 * Flattens the nested folder structure created by TypeDoc
 */
async function flattenApiStructure() {
  const subDirs = ["classes", "functions", "type-aliases"];

  for (const subDir of subDirs) {
    const subDirPath = path.join(DOCS_DIR, subDir);

    try {
      // Check if subdirectory exists
      await fs.access(subDirPath);

      // Get all .mdx files in the subdirectory
      const files = await fs.readdir(subDirPath);
      const mdxFiles = files.filter((file) => file.endsWith(".mdx"));

      // Move each file to the parent directory
      for (const file of mdxFiles) {
        const sourcePath = path.join(subDirPath, file);
        const targetPath = path.join(DOCS_DIR, file);

        await fs.rename(sourcePath, targetPath);
        console.log(`📋 Moved ${subDir}/${file} to root`);
      }

      // Remove the now-empty subdirectory
      await fs.rmdir(subDirPath);
      console.log(`🗑️  Removed empty directory: ${subDir}`);
    } catch (error) {
      // Directory might not exist, that's ok
      if (error.code !== "ENOENT") {
        console.warn(
          `⚠️  Warning: Could not process ${subDir}: ${error.message}`,
        );
      }
    }
  }
}

async function buildApiDocs() {
  console.log("🚀 Building API documentation...");

  try {
    // Clean existing API docs
    console.log("🧹 Cleaning existing API docs...");
    try {
      await fs.rm(DOCS_DIR, { recursive: true, force: true });
    } catch (_e) {
      // Directory might not exist, that's ok
    }

    // Generate docs
    console.log("📝 Generating TypeDoc documentation...");
    execSync("pnpm --filter=@llamaindex/workflow-core run build:docs", {
      stdio: "inherit",
    });

    // Flatten the folder structure
    console.log("📁 Flattening folder structure...");
    await flattenApiStructure();

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
