# Embedded Documentation

Use this when ventyd is installed locally. Embedded docs match the exact installed version — they are the most reliable source of truth.

## Verify Installation

```bash
ls node_modules/ventyd/
```

If ventyd is installed, proceed with the strategies below. If not, see `references/quick-start.md` or `references/remote-docs.md`.

## Type Declaration Files

Ventyd's type declaration files contain extensive TSDoc comments with detailed API documentation, usage examples, and design rationale. These are the primary embedded documentation.

### Key Files

Read these files to understand ventyd's API:

| File | Contents |
|------|----------|
| `node_modules/ventyd/dist/index.d.mts` | All public exports (functions and types) |
| `node_modules/ventyd/dist/types/Plugin.d.mts` | Plugin interface — execution model, error handling, common patterns |
| `node_modules/ventyd/dist/types/Adapter.d.mts` | Adapter interface — required/optional methods, implementation guide |
| `node_modules/ventyd/dist/types/Repository.d.mts` | Repository interface — findOne, commit |
| `node_modules/ventyd/dist/types/Schema.d.mts` | Schema type — event/state type definitions |
| `node_modules/ventyd/dist/types/Entity.d.mts` | Entity type — create, load, state, version |
| `node_modules/ventyd/dist/types/Reducer.d.mts` | Reducer function signature |
| `node_modules/ventyd/dist/types/MutationMethod.d.mts` | Mutation method type |
| `node_modules/ventyd/dist/types/ReadonlyEntity.d.mts` | ReadonlyEntity type (CQRS pattern) |

### Validation Library Integrations

| File | Contents |
|------|----------|
| `node_modules/ventyd/dist/valibot.d.mts` | Valibot schema provider |
| `node_modules/ventyd/dist/zod.d.mts` | Zod schema provider |
| `node_modules/ventyd/dist/arktype.d.mts` | ArkType schema provider |
| `node_modules/ventyd/dist/typebox.d.mts` | TypeBox schema provider |
| `node_modules/ventyd/dist/standard.d.mts` | Generic Standard Schema provider |

### Adapter

| File | Contents |
|------|----------|
| `node_modules/ventyd/dist/adapter/prisma.d.mts` | Prisma ORM adapter |

## Search Strategies

### Find a specific API

```bash
grep -r "export.*defineSchema" node_modules/ventyd/dist/index.d.mts
```

### Find interface details

```bash
grep -A 50 "interface Plugin" node_modules/ventyd/dist/types/Plugin.d.mts
```

### Find all exported types

```bash
grep "export" node_modules/ventyd/dist/index.d.mts
```

### Find validation library usage

```bash
cat node_modules/ventyd/dist/valibot.d.mts
```

## When Embedded Docs Are Insufficient

If type declarations don't have enough detail:

1. **Check the source map**: Read `node_modules/ventyd/dist/` JavaScript files for implementation details
2. **Fall back to remote docs**: See `references/remote-docs.md`
3. **Check common errors**: See `references/common-errors.md`

## Reading Tips

- The `Plugin.d.mts` and `Adapter.d.mts` files have the most extensive documentation (~300 lines each)
- TSDoc comments include `@remarks`, `@example`, and `@see` tags
- Type inference utilities (`InferStateFromSchema`, etc.) are documented in `types/Schema.d.mts`
