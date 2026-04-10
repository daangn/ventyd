import { docs } from "fumadocs-mdx:collections/server";
import { getLLMText } from "@/lib/get-llm-text";

export async function loader() {
  const texts = await Promise.all(docs.docs.map(getLLMText));

  return new Response(texts.join("\n\n---\n\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
