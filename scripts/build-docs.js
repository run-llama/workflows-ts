#!/usr/bin/env node

import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { addFrontmatter } from "./add-frontmatter.js";

const DOCS_DIR = "./docs/workflows/api-reference";

/**
 * Recursively finds all .mdx files in a directory
 */
async function findAllMdxFiles(dir, basePath = "") {
  const files = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await findAllMdxFiles(fullPath, relativePath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
        // Skip README files as they're just aggregation pages
        if (entry.name === "README.mdx") {
          continue;
        }

        // Skip deprecated functions
        if (entry.name === "getContext.mdx") {
          continue;
        }

        files.push({
          sourcePath: fullPath,
          originalPath: relativePath,
          fileName: entry.name,
        });
      }
    }
  } catch (error) {
    console.warn(
      `⚠️  Warning: Could not read directory ${dir}: ${error.message}`,
    );
  }

  return files;
}

/**
 * Flattens the nested folder structure created by TypeDoc
 */
async function flattenApiStructure() {
  // Find all .mdx files recursively (except README files which we'll handle separately)
  const allFiles = await findAllMdxFiles(DOCS_DIR);

  // Track used filenames to handle conflicts
  const usedNames = new Set();

  for (const fileInfo of allFiles) {
    let targetFileName = fileInfo.fileName;

    // Handle name conflicts by prefixing with directory info if needed
    if (usedNames.has(targetFileName)) {
      // Extract meaningful prefix from the path
      const pathParts = fileInfo.originalPath.split(path.sep);
      const meaningfulParts = pathParts.filter(
        (part) =>
          part !== "classes" &&
          part !== "functions" &&
          part !== "type-aliases" &&
          part !== "README.mdx",
      );

      if (meaningfulParts.length > 1) {
        const prefix = meaningfulParts[meaningfulParts.length - 2]; // Use parent directory
        targetFileName = `${prefix}-${fileInfo.fileName}`;
      }
    }

    usedNames.add(targetFileName);

    const targetPath = path.join(DOCS_DIR, targetFileName);

    try {
      await fs.rename(fileInfo.sourcePath, targetPath);
      console.log(`📋 Moved ${fileInfo.originalPath} → ${targetFileName}`);
    } catch (error) {
      console.warn(
        `⚠️  Warning: Could not move ${fileInfo.originalPath}: ${error.message}`,
      );
    }
  }

  // Clean up unwanted files (README files and deprecated functions)
  await cleanupUnwantedFiles(DOCS_DIR);

  // Remove all empty directories
  await removeEmptyDirectories(DOCS_DIR);
}

/**
 * Recursively removes unwanted files (README files and deprecated functions)
 */
async function cleanupUnwantedFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively clean subdirectories
        await cleanupUnwantedFiles(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
        // Remove README files and deprecated functions
        if (entry.name === "README.mdx" || entry.name === "getContext.mdx") {
          await fs.rm(fullPath);
          console.log(
            `🗑️  Removed unwanted file: ${path.relative(DOCS_DIR, fullPath)}`,
          );
        }
      }
    }
  } catch (error) {
    console.warn(
      `⚠️  Warning: Could not clean directory ${dir}: ${error.message}`,
    );
  }
}

/**
 * Recursively removes empty directories
 */
async function removeEmptyDirectories(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    // First, recursively clean subdirectories
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = path.join(dir, entry.name);
        await removeEmptyDirectories(subDir);
      }
    }

    // Then check if this directory is now empty (only contains meta.json or is completely empty)
    const remainingEntries = await fs.readdir(dir);
    const nonMetaFiles = remainingEntries.filter(
      (name) => name !== "meta.json",
    );

    if (nonMetaFiles.length === 0 && dir !== DOCS_DIR) {
      await fs.rmdir(dir);
      console.log(
        `🗑️  Removed empty directory: ${path.relative(DOCS_DIR, dir)}`,
      );
    }
  } catch (error) {
    // Directory might not exist or might not be empty, that's ok
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

    // Remove generated README.mdx if it exists
    try {
      await fs.rm(path.join(DOCS_DIR, "README.mdx"));
    } catch (error) {
      // File might not exist, that's ok
    }

    console.log("✅ API documentation built successfully!");
    console.log(`📁 Output location: ${DOCS_DIR}`);
    console.log("🎯 All files now include proper frontmatter headers");
  } catch (error) {
    console.error("❌ Error building API docs:", error.message);
    process.exit(1);
  }
}

buildApiDocs();
