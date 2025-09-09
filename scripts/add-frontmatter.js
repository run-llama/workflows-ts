#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const DOCS_DIR = "./docs/workflows/api-reference";

/**
 * Extracts the main heading from markdown content
 */
function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  if (!match) return "API Reference";

  // Stop matching at <> or () characters and clean up
  let title = match[1]
    .replace(/`/g, "") // Remove backticks
    .replace(/^([^<(]+)[<(].*$/, "$1") // Stop at < or ( characters
    .replace(/\\+$/, "") // Remove trailing backslashes
    .replace(/\\(.)/g, "$1") // Remove escape characters
    .trim(); // Remove trailing whitespace

  // Remove TypeDoc prefixes (Class:, Type Alias:, Function:, etc.)
  title = title.replace(
    /^(Class|Type Alias|Function|Interface|Enum|Variable|Namespace):\s*/,
    "",
  );

  return title || "API Reference";
}

/**
 * Extracts the first meaningful paragraph as description
 */
function extractDescription(content) {
  // Look for the first meaningful paragraph after the title
  const lines = content.split("\n");
  let foundTitle = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!foundTitle && line.startsWith("#")) {
      foundTitle = true;
      continue;
    }

    if (!foundTitle) continue;

    // Skip empty lines
    if (!line.trim()) continue;

    // Skip technical lines we don't want in descriptions
    if (
      line.startsWith(">") || // Code signatures
      line.startsWith("```") || // Code blocks
      line.startsWith("[") || // Breadcrumb links
      line.startsWith("Defined in:") || // Source location
      line.match(/^Defined in: \[/) || // Source links
      line.includes("github.com") || // GitHub links
      line.startsWith("##") || // Subheadings
      line.startsWith("###") || // Sub-subheadings
      line.startsWith("####") // Further subheadings
    ) {
      continue;
    }

    // Look for descriptive paragraphs
    if (line.trim().length > 20) {
      // Clean up the description
      let desc = line.trim();
      desc = desc.replace(/\*\*/g, ""); // Remove bold
      desc = desc.replace(/`([^`]+)`/g, "$1"); // Remove code ticks
      desc = desc.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // Remove links

      // Check if this looks like a good description
      if (desc.length > 20 && desc.length < 200 && !desc.includes(":::")) {
        // Look ahead to see if there's more content to include
        let fullDesc = desc;
        for (let j = i + 1; j < lines.length && j < i + 3; j++) {
          const nextLine = lines[j].trim();
          if (
            nextLine &&
            !nextLine.startsWith("#") &&
            !nextLine.startsWith(">") &&
            !nextLine.startsWith("```") &&
            !nextLine.startsWith("@") &&
            nextLine.length > 10
          ) {
            fullDesc += ` ${nextLine.replace(/\*\*/g, "").replace(/`([^`]+)`/g, "$1")}`;
          } else {
            break;
          }
        }

        // Limit description length
        if (fullDesc.length > 180) {
          fullDesc = `${fullDesc.substring(0, 180).trim()}...`;
        }

        return fullDesc;
      }
    }
  }

  return null;
}

/**
 * Generates appropriate frontmatter for different file types
 */
function generateFrontmatter(filePath, content) {
  const fileName = path.basename(filePath, ".mdx");
  const dirName = path.basename(path.dirname(filePath));
  const title = extractTitle(content);
  const description = extractDescription(content);

  const frontmatter = {
    title: title,
  };

  // Add description if available
  if (description) {
    frontmatter.description = description;
  }

  // Add specific metadata for special files
  if (fileName === "README") {
    frontmatter.slug = "/api-reference";
    frontmatter.sidebar_position = 1;
  } else {
    // For all other files, just use the filename as sidebar label
    frontmatter.sidebar_label = fileName;
  }

  // Generate YAML frontmatter
  const yamlLines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (
      typeof value === "string" &&
      (value.includes(":") || value.includes('"') || value.includes("'"))
    ) {
      yamlLines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
    } else {
      yamlLines.push(`${key}: ${value}`);
    }
  }
  yamlLines.push("---", "");

  return yamlLines.join("\n");
}

/**
 * Removes the first main heading from markdown content
 */
function removeMainHeading(content) {
  const lines = content.split("\n");
  const newLines = [];
  let foundFirstHeading = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip the first main heading (# Title)
    if (!foundFirstHeading && line.match(/^#\s+/)) {
      foundFirstHeading = true;
      // Also skip the next line if it's empty (common after titles)
      if (i + 1 < lines.length && !lines[i + 1].trim()) {
        i++; // Skip the next empty line too
      }
      continue;
    }

    newLines.push(line);
  }

  return newLines.join("\n");
}

/**
 * Processes a single markdown file to add frontmatter
 */
async function processFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");

    // Skip if frontmatter already exists
    if (content.startsWith("---")) {
      console.log(
        `⏭️  Skipping ${path.relative(process.cwd(), filePath)} (already has frontmatter)`,
      );
      return;
    }

    const frontmatter = generateFrontmatter(filePath, content);
    // Remove the original markdown title to prevent duplication
    const contentWithoutTitle = removeMainHeading(content);
    const newContent = frontmatter + contentWithoutTitle;

    await fs.writeFile(filePath, newContent, "utf8");
    console.log(
      `✅ Added frontmatter to ${path.relative(process.cwd(), filePath)}`,
    );
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

/**
 * Recursively finds all .mdx files in a directory
 */
async function findMdxFiles(dir) {
  const files = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await findMdxFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`❌ Error reading directory ${dir}:`, error.message);
  }

  return files;
}

/**
 * Main function to add frontmatter to all generated docs
 */
async function addFrontmatter() {
  console.log("🔧 Adding frontmatter to API documentation files...");

  try {
    // Check if docs directory exists
    await fs.access(DOCS_DIR);
  } catch (_error) {
    console.error(`❌ Documentation directory not found: ${DOCS_DIR}`);
    console.error(
      '💡 Run "pnpm run build:docs:core" first to generate the documentation.',
    );
    process.exit(1);
  }

  // Find all .mdx files
  const mdxFiles = await findMdxFiles(DOCS_DIR);

  if (mdxFiles.length === 0) {
    console.log("⚠️  No .mdx files found in the documentation directory");
    return;
  }

  console.log(`📄 Found ${mdxFiles.length} documentation files`);

  // Process each file
  for (const file of mdxFiles) {
    await processFile(file);
  }

  console.log("✨ Frontmatter processing complete!");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addFrontmatter().catch((error) => {
    console.error("❌ Failed to add frontmatter:", error);
    process.exit(1);
  });
}

export { addFrontmatter };
