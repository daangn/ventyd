import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("docs/*", "docs/page.tsx"),
  route("api/search", "docs/search.ts"),
  route("llms-full.txt", "routes/llms-full.ts"),
  route("llms/*", "routes/llm-page.ts"),
] satisfies RouteConfig;
