# Embedded Documentation

Use this when ventyd is installed locally. Embedded docs match the exact installed version — they are the most reliable source of truth.

## Verify Installation

```bash
ls node_modules/ventyd/
```

If ventyd is installed, proceed with the strategies below. If not, see `references/quick-start.md` or `references/remote-docs.md`.

## Documentation Files

Ventyd ships Markdown documentation inside the package at `node_modules/ventyd/dist/docs/`. These are clean Markdown files generated from the official documentation.

### How to Read

```bash
cat node_modules/ventyd/dist/docs/quick-start.md
```

### File Map

| File | Topic | Use When |
|------|-------|----------|
| `dist/docs/quick-start.md` | First entity walkthrough | Learning the basic pattern |
| `dist/docs/installation.md` | Installation + validation library setup | Setting up a new project |
| `dist/docs/core-concepts.md` | Event sourcing fundamentals | Understanding architecture |
| `dist/docs/schema.md` | Schema definition + all validation libraries | Choosing/using Valibot, Zod, TypeBox, ArkType |
| `dist/docs/database.md` | Adapter interface + implementation guide | Connecting to a database |
| `dist/docs/plugins.md` | Plugin interface + common patterns | Adding side effects (analytics, logging, webhooks) |
| `dist/docs/querying.md` | Query by custom fields + denormalized views | Looking up entities by non-ID fields |
| `dist/docs/testing.md` | Entity testing + integration testing | Writing tests for entities |
| `dist/docs/event-naming.md` | Event naming conventions | Naming events correctly |
| `dist/docs/event-granularity.md` | Fine vs coarse-grained events | Deciding event detail level |
| `dist/docs/event-versioning.md` | Schema evolution + migration strategies | Handling event schema changes |
| `dist/docs/error-handling.md` | Error handling patterns | Implementing validation and error recovery |

### Search Across Docs

```bash
grep -r "Plugin" node_modules/ventyd/dist/docs/
```

```bash
grep -rl "adapter" node_modules/ventyd/dist/docs/
```

## Type Declaration Files (Supplementary)

For precise API signatures and type definitions, read the type declaration files:

| File | Contents |
|------|----------|
| `dist/index.d.mts` | All public exports (functions and types) |
| `dist/types/Plugin.d.mts` | Plugin interface with extensive TSDoc |
| `dist/types/Adapter.d.mts` | Adapter interface with implementation examples |
| `dist/types/Repository.d.mts` | Repository interface — findOne, commit |
| `dist/types/Schema.d.mts` | Schema type definitions |
| `dist/types/Entity.d.mts` | Entity type — create, load, state, version |

These contain TSDoc comments with `@remarks`, `@example`, and `@see` tags.

## Priority

1. **dist/docs/*.md** — Human-readable documentation with examples and explanations
2. **dist/types/*.d.mts** — Precise type signatures and TSDoc for API details
3. **Remote docs** — See `references/remote-docs.md` if local files are insufficient
