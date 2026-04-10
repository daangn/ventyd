# Remote Documentation

Use this when ventyd packages are not installed locally, or when you need conceptual explanations and guides beyond API signatures.

## Documentation Site

Ventyd documentation is hosted at: **https://ventyd.com**

Prefer embedded docs when packages are installed (version accuracy). Use remote docs for current information when packages are not available.

## Page Map

| URL | Topic | Use When |
|-----|-------|----------|
| `https://ventyd.com/docs/installation` | Installation + validation library setup | Setting up a new project |
| `https://ventyd.com/docs/quick-start` | First entity walkthrough | Learning the basic pattern |
| `https://ventyd.com/docs/core-concepts` | Event sourcing fundamentals | Understanding architecture |
| `https://ventyd.com/docs/schema` | Schema definition + all validation libraries | Choosing/using Valibot, Zod, TypeBox, ArkType |
| `https://ventyd.com/docs/database` | Adapter interface + implementation guide | Connecting to a database |
| `https://ventyd.com/docs/plugins` | Plugin interface + common patterns | Adding side effects (analytics, logging, webhooks) |
| `https://ventyd.com/docs/querying` | Query by custom fields + denormalized views | Looking up entities by non-ID fields |
| `https://ventyd.com/docs/testing` | Entity testing + integration testing | Writing tests for entities |
| `https://ventyd.com/docs/event-naming` | Event naming conventions | Naming events correctly |
| `https://ventyd.com/docs/event-granularity` | Fine vs coarse-grained events | Deciding event detail level |
| `https://ventyd.com/docs/event-versioning` | Schema evolution + migration strategies | Handling event schema changes |
| `https://ventyd.com/docs/error-handling` | Error handling patterns | Implementing validation and error recovery |

## How to Use Remote Docs

Fetch the page URL and read the content. The documentation uses standard Markdown with code examples.

### Lookup by Topic

1. Identify the user's question topic
2. Find the matching URL from the page map above
3. Fetch the page content
4. Use the information to answer or generate code

### When Multiple Pages Are Relevant

For complex tasks, you may need to combine information from multiple pages. For example:
- "Build an entity with Prisma" → `schema` + `database` pages
- "Add analytics tracking" → `plugins` page
- "Handle event schema changes" → `event-versioning` page

## Priority

1. **Embedded docs** — Always prefer when ventyd is installed (version-accurate)
2. **Remote docs** — Use when packages are not installed or for conceptual guides
3. **This skill's SKILL.md** — Contains core patterns and rules that are always available
