import { glob } from "node:fs/promises";
import type { Config } from "@react-router/dev/config";
import { createGetUrl, getSlugs } from "fumadocs-core/source";

const getUrl = createGetUrl("/docs");
const getLlmUrl = createGetUrl("/llms");

export default {
  ssr: false,
  async prerender({ getStaticPaths }) {
    const paths: string[] = [];
    const excluded: string[] = [];

    for (const path of getStaticPaths()) {
      if (!excluded.includes(path)) paths.push(path);
    }

    for await (const entry of glob("**/*.mdx", { cwd: "content/docs" })) {
      const slugs = getSlugs(entry);
      paths.push(getUrl(slugs));
      // index.mdx → slugs is empty → skip LLM route (no wildcard match)
      if (slugs.length > 0) {
        paths.push(getLlmUrl(slugs));
      }
    }

    paths.push("/llms-full.txt");

    return paths;
  },
} satisfies Config;
