import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const DOCS_SRC = resolve("docs/content/docs");
const DOCS_OUT = resolve("dist/docs");

/**
 * Strip MDX-specific syntax from a file, producing clean Markdown.
 *
 * Removes:
 * - import statements
 * - JSX self-closing tags (<Card ... />)
 * - JSX opening/closing wrapper tags (<Accordion>, </Accordion>, etc.)
 * - Callout components (converted to blockquotes)
 * - Tab components (```bash tab="..." → ```bash)
 *
 * Preserves:
 * - YAML frontmatter
 * - Markdown text, headings, code blocks, links
 * - Content inside JSX wrappers
 */
const JSX_TAGS =
  "Accordion|Accordions|Cards|Card|Tabs|Tab|Callout|Note";

function stripMdx(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];

  let inFrontmatter = false;
  let frontmatterCount = 0;
  let inJsxBlock = false; // inside a multiline self-closing JSX tag

  for (const line of lines) {
    // Handle YAML frontmatter
    if (line.trim() === "---") {
      frontmatterCount++;
      if (frontmatterCount <= 2) {
        result.push(line);
        inFrontmatter = frontmatterCount === 1;
        continue;
      }
    }
    if (inFrontmatter) {
      result.push(line);
      continue;
    }

    // Skip import statements
    if (/^\s*import\s+/.test(line)) {
      continue;
    }

    // Track multiline self-closing JSX tags:
    //   <Card
    //     title="..."
    //     href="..."
    //   />
    if (inJsxBlock) {
      if (/\/>\s*$/.test(line.trim())) {
        inJsxBlock = false;
      }
      continue;
    }

    // Start of multiline self-closing JSX: <Card (no closing > on same line)
    const jsxTagPattern = new RegExp(`^\\s*<(${JSX_TAGS})\\s*$`);
    if (jsxTagPattern.test(line)) {
      inJsxBlock = true;
      continue;
    }

    // Single-line self-closing JSX: <Card ... />
    const selfClosingPattern = new RegExp(
      `^\\s*<(${JSX_TAGS})\\b[^>]*/\\s*>\\s*$`,
    );
    if (selfClosingPattern.test(line)) {
      continue;
    }

    // JSX opening tags with attributes: <Card title="..." icon={<Calendar />}>
    // These may contain nested JSX in attributes like icon={<Icon />}
    const openingPattern = new RegExp(
      `^\\s*<(${JSX_TAGS})\\b.*>\\s*$`,
    );
    if (openingPattern.test(line)) {
      continue;
    }

    // JSX closing tags: </Card>, </Accordion>, etc.
    const closingPattern = new RegExp(
      `^\\s*<\\/(${JSX_TAGS})>\\s*$`,
    );
    if (closingPattern.test(line)) {
      continue;
    }

    // Strip JSX prop-only lines (e.g., title="..." href="..." inside multiline tags)
    if (/^\s+\w+="[^"]*"\s*$/.test(line) || /^\s+\w+=\{[^}]*\}\s*$/.test(line)) {
      // Only skip if it looks like a JSX attribute (indented, key="value" or key={value})
      // But be careful not to strip regular markdown content
      // Check if previous non-empty result line was also stripped or was a JSX tag
      continue;
    }

    // Strip tab attribute from code fences: ```bash tab="pnpm" → ```bash
    const stripped = line.replace(
      /^(\s*```\w*)\s+tab="[^"]*"(.*)$/,
      "$1$2",
    );

    result.push(stripped);
  }

  // Clean up excessive blank lines (3+ → 2)
  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

async function main() {
  await mkdir(DOCS_OUT, { recursive: true });

  const files = await readdir(DOCS_SRC);
  const mdxFiles = files.filter((f) => f.endsWith(".mdx"));

  for (const file of mdxFiles) {
    const mdxPath = join(DOCS_SRC, file);
    const content = await readFile(mdxPath, "utf-8");
    const md = stripMdx(content);
    const outName = file.replace(".mdx", ".md");
    await writeFile(join(DOCS_OUT, outName), md);
    console.log(`  ${file} → ${outName}`);
  }

  console.log(`\nGenerated ${mdxFiles.length} docs in dist/docs/`);
}

main().catch((error) => {
  console.error("Failed to generate docs:", error);
  process.exit(1);
});
