import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const DOCS_BUILD = resolve("docs/build/client/llms");
const DOCS_OUT = resolve("dist/docs");

/**
 * Strip remaining MDX-specific syntax from fumadocs getText('processed') output.
 *
 * fumadocs getText('processed') does basic remark processing but preserves
 * import statements and JSX components. This function cleans those up.
 */
function stripMdxArtifacts(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];

  const JSX_TAGS =
    "Accordion|Accordions|Cards|Card|Tabs|Tab|Callout|Note";

  let inJsxBlock = false;

  for (const line of lines) {
    // Skip import statements
    if (/^\s*import\s+/.test(line)) {
      continue;
    }

    // Track multiline self-closing JSX tags
    if (inJsxBlock) {
      if (/\/>\s*$/.test(line.trim())) {
        inJsxBlock = false;
      }
      continue;
    }

    // Start of multiline self-closing JSX
    const jsxTagPattern = new RegExp(`^\\s*<(${JSX_TAGS})\\s*$`);
    if (jsxTagPattern.test(line)) {
      inJsxBlock = true;
      continue;
    }

    // Single-line self-closing JSX
    const selfClosingPattern = new RegExp(
      `^\\s*<(${JSX_TAGS})\\b[^>]*/\\s*>\\s*$`,
    );
    if (selfClosingPattern.test(line)) {
      continue;
    }

    // JSX opening tags (with any attributes including nested JSX like icon={<X />})
    const openingPattern = new RegExp(`^\\s*<(${JSX_TAGS})\\b.*>\\s*$`);
    if (openingPattern.test(line)) {
      continue;
    }

    // JSX closing tags
    const closingPattern = new RegExp(`^\\s*<\\/(${JSX_TAGS})>\\s*$`);
    if (closingPattern.test(line)) {
      continue;
    }

    // Convert heading anchors: "Title [#slug]" → "## Title"
    const headingMatch = line.match(/^(\S.+?)\s+\[#[\w-]+\]\s*$/);
    if (headingMatch && !line.startsWith("```") && !line.startsWith("  ")) {
      result.push(`## ${headingMatch[1]}`);
      continue;
    }

    // Strip tab attribute from code fences
    const stripped = line.replace(
      /^(\s*```\w*)\s+tab="[^"]*"(.*)$/,
      "$1$2",
    );

    result.push(stripped);
  }

  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

async function main() {
  await mkdir(DOCS_OUT, { recursive: true });

  let files: string[];
  try {
    files = await readdir(DOCS_BUILD);
  } catch {
    console.error(
      "docs/build/client/llms/ not found. Run `npm run build` in docs/ first.",
    );
    process.exit(1);
  }

  // Filter to only data-less resource files (the actual markdown content)
  const pages = files.filter((f) => !f.endsWith(".data"));
  let count = 0;

  for (const file of pages) {
    const content = await readFile(join(DOCS_BUILD, file), "utf-8");
    const md = stripMdxArtifacts(content);
    await writeFile(join(DOCS_OUT, `${file}.md`), md);
    console.log(`  ${file} → ${file}.md`);
    count++;
  }

  console.log(`\nGenerated ${count} docs in dist/docs/`);
}

main().catch((error) => {
  console.error("Failed to generate docs:", error);
  process.exit(1);
});
