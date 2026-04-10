---
name: ventyd
description: >
  Event sourcing with the ventyd TypeScript library. Use when defining schemas,
  reducers, entities, mutations, repositories, adapters, or plugins with ventyd.
  Covers defineSchema, defineReducer, Entity, mutation, createRepository, and the
  Adapter/Plugin interfaces.
license: MIT
metadata:
  author: daangn
  version: "1.0"
  repository: https://github.com/daangn/ventyd
---

# Ventyd Event Sourcing Guide

Build event-sourced applications with Ventyd. This skill teaches you how to find current documentation and write correct ventyd code.

## Critical: Do not trust internal knowledge

Everything you know about ventyd is likely outdated or wrong. Never rely on memory. Your training data may contain obsolete APIs. Always verify against the documentation referenced in this skill.

## Prerequisites

Before writing code, verify package installation:

```bash
ls node_modules/ventyd/
```

- **Packages exist:** Use embedded docs (most reliable, matches exact installed version)
- **No packages:** Install first using `references/quick-start.md`, or use remote docs

## Available Files Reference

| Question | Resource | Purpose |
|----------|----------|---------|
| Project setup / installation | `references/quick-start.md` | Installation and first entity guide |
| API usage / type signatures | `references/embedded-docs.md` | Look up via installed package type declarations |
| Usage without packages | `references/remote-docs.md` | Fetch from `https://ventyd.com/docs/` |
| Error resolution | `references/common-errors.md` | Troubleshooting solutions |

## Priority: Documentation Lookup Order

1. **Embedded docs** (if packages installed)
   - Most reliable, matches exact installed version
   - Read type declaration files: `node_modules/ventyd/dist/types/*.d.mts`
   - These contain extensive TSDoc with usage examples

2. **Source code** (if packages installed)
   - Ultimate truth source when docs are unclear
   - Read: `node_modules/ventyd/dist/index.mjs`

3. **Remote docs** (if packages not installed)
   - Latest published documentation
   - Access: `https://ventyd.com/docs/`

## Core Architecture

Ventyd follows a four-building-block pattern:

```
Schema  →  Reducer  →  Entity  →  Repository
(events     (state      (business   (persistence
 + state)    from         logic)      + plugins)
             events)
```

**Data flow:**

```
1. Entity.create() or mutation()
2. → dispatch(eventName, body)
3. → event validated against schema
4. → reducer computes new state
5. → repository.commit() persists events via adapter
6. → plugins run side effects (parallel, non-blocking)
```

## Complete Example: User Entity

```typescript
import * as v from "valibot";
import { defineSchema, defineReducer, Entity, mutation, createRepository } from "ventyd";
import { valibot } from "ventyd/valibot";
import type { Adapter } from "ventyd";

// 1. Define schema
const userSchema = defineSchema("user", {
  schema: valibot({
    event: {
      created: v.object({
        nickname: v.string(),
        email: v.pipe(v.string(), v.email()),
      }),
      profile_updated: v.object({
        nickname: v.optional(v.string()),
        bio: v.optional(v.string()),
      }),
      deleted: v.object({
        reason: v.optional(v.string()),
      }),
      restored: v.object({}),
    },
    state: v.object({
      nickname: v.string(),
      email: v.pipe(v.string(), v.email()),
      bio: v.optional(v.string()),
      deletedAt: v.nullable(v.optional(v.string())),
    }),
  }),
  initialEventName: "user:created",
});

// 2. Define reducer
const userReducer = defineReducer(userSchema, (prevState, event) => {
  switch (event.eventName) {
    case "user:created":
      return {
        nickname: event.body.nickname,
        email: event.body.email,
        bio: undefined,
        deletedAt: null,
      };
    case "user:profile_updated":
      return {
        ...prevState,
        ...(event.body.nickname && { nickname: event.body.nickname }),
        ...(event.body.bio !== undefined && { bio: event.body.bio }),
      };
    case "user:deleted":
      return { ...prevState, deletedAt: event.eventCreatedAt };
    case "user:restored":
      return { ...prevState, deletedAt: null };
    default:
      return prevState;
  }
});

// 3. Create entity class with business logic
class User extends Entity(userSchema, userReducer) {
  get nickname() { return this.state.nickname; }
  get email() { return this.state.email; }
  get isDeleted() { return this.state.deletedAt !== null; }

  updateProfile = mutation(
    this,
    (dispatch, updates: { nickname?: string; bio?: string }) => {
      if (this.isDeleted) {
        throw new Error("Cannot update profile of deleted user");
      }
      dispatch("user:profile_updated", updates);
    },
  );

  delete = mutation(this, (dispatch, reason?: string) => {
    if (this.isDeleted) throw new Error("User is already deleted");
    dispatch("user:deleted", { reason });
  });

  restore = mutation(this, (dispatch) => {
    if (!this.isDeleted) throw new Error("User is not deleted");
    dispatch("user:restored", {});
  });
}

// 4. Create repository
const userRepository = createRepository(User, {
  adapter: myAdapter, // implement Adapter interface
  plugins: [],        // optional Plugin[]
});

// 5. Use it
const user = User.create({
  body: { email: "alice@example.com", nickname: "Alice" },
});
user.updateProfile({ bio: "Software engineer" });
await userRepository.commit(user);

const loaded = await userRepository.findOne({ entityId: user.entityId });
console.log(loaded?.state.bio); // "Software engineer"
```

## Critical Rules

### Event Naming
- Event names use **snake_case** and **past tense**: `created`, `profile_updated`, `deleted`
- Ventyd auto-prefixes with entity name: `created` → `user:created`
- `initialEventName` must be fully qualified: `"user:created"` (not `"created"`)

### Reducer
- Always handle the `default` case returning `prevState`
- Never mutate `prevState` — return a new object
- Use `event.body` for event data, `event.eventCreatedAt` for timestamps

### Mutations
- Validate business rules **before** calling `dispatch()`
- Use the `mutation(this, fn)` helper — not raw `$$dispatch()`
- `Entity.load()` returns readonly entities — mutations are stripped at the type level

### Repository
- `createRepository(Entity, { adapter, plugins?, onPluginError?, migrate?, snapshot? })`
- `findOne({ entityId })` returns mutable entity or `null`
- `commit(entity)` persists pending events

## Import Cheatsheet

```typescript
// Core
import { defineSchema, defineReducer, Entity, mutation, createRepository } from "ventyd";
import type { Adapter, Plugin, Repository, Schema, ReadonlyEntity } from "ventyd";

// Validation libraries (pick one)
import { valibot, v } from "ventyd/valibot";
import { zod, z } from "ventyd/zod";
import { arktype, type } from "ventyd/arktype";
import { typebox, Type } from "ventyd/typebox";
import { standard } from "ventyd/standard"; // generic Standard Schema

// Adapters
import { prismaAdapter } from "ventyd/adapter/prisma";
```

## Error Handling

Type errors often signal outdated knowledge. Common indicators include "Property X does not exist," module not found, and constructor parameter errors.

**Response approach:**
1. Check `references/common-errors.md`
2. Verify current API in embedded docs (type declarations)
3. Recognize errors may reflect knowledge gaps, not user mistakes
