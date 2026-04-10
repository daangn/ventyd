import { docs } from "fumadocs-mdx:collections/server";
import { getLLMText } from "@/lib/get-llm-text";
import type { Route } from "./+types/llm-page";

export async function loader({ params }: Route.LoaderArgs) {
  const slug = params["*"];
  const page = docs.docs.find(
    (p) => p.info.path.replace(/\.mdx$/, "") === slug,
  );

  if (!page) {
    throw new Response("Not found", { status: 404 });
  }

  const text = await getLLMText(page);
  return new Response(text, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
