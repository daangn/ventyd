# Quick Start

Set up ventyd and build your first event-sourced entity.

## Installation

### 1. Install ventyd

```bash
npm install ventyd
```

### 2. Choose a validation library

Ventyd uses [Standard Schema](https://standardschema.dev). Pick one:

| Library | Install | Import | Best For |
|---------|---------|--------|----------|
| **Valibot** | `npm install valibot` | `import { valibot, v } from "ventyd/valibot"` | Smallest bundle, modern |
| **Zod** | `npm install zod` | `import { zod, z } from "ventyd/zod"` | Most popular, largest ecosystem |
| **TypeBox** | `npm install typebox` | `import { typebox, Type } from "ventyd/typebox"` | JSON Schema support |
| **ArkType** | `npm install arktype` | `import { arktype, type } from "ventyd/arktype"` | Fastest validation |

### 3. TypeScript configuration

Ventyd requires TypeScript 5.0+ with `strict: true`:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

## Build Your First Entity

This example uses Valibot. The same pattern applies with any validation library.

### Step 1: Define Schema

```typescript
import { defineSchema } from "ventyd";
import { valibot, v } from "ventyd/valibot";

export const userSchema = defineSchema("user", {
  schema: valibot({
    event: {
      created: v.object({
        email: v.pipe(v.string(), v.email()),
        name: v.string(),
      }),
      profile_updated: v.object({
        name: v.optional(v.string()),
        bio: v.optional(v.string()),
      }),
    },
    state: v.object({
      email: v.string(),
      name: v.string(),
      bio: v.optional(v.string()),
    }),
  }),
  initialEventName: "user:created",
});
```

### Step 2: Define Reducer

```typescript
import { defineReducer } from "ventyd";
import { userSchema } from "./user.schema";

export const userReducer = defineReducer(userSchema, (prevState, event) => {
  switch (event.eventName) {
    case "user:created":
      return {
        email: event.body.email,
        name: event.body.name,
        bio: undefined,
      };
    case "user:profile_updated":
      return {
        ...prevState,
        ...(event.body.name && { name: event.body.name }),
        ...(event.body.bio !== undefined && { bio: event.body.bio }),
      };
    default:
      return prevState;
  }
});
```

### Step 3: Create Entity Class

```typescript
import { Entity, mutation } from "ventyd";
import { userSchema } from "./user.schema";
import { userReducer } from "./user.reducer";

export class User extends Entity(userSchema, userReducer) {
  get email() { return this.state.email; }
  get name() { return this.state.name; }
  get bio() { return this.state.bio; }

  updateProfile = mutation(
    this,
    (dispatch, updates: { name?: string; bio?: string }) => {
      if (!updates.name && updates.bio === undefined) {
        throw new Error("Must provide at least one field to update");
      }
      dispatch("user:profile_updated", updates);
    },
  );
}
```

### Step 4: Set Up Repository

```typescript
import { createRepository } from "ventyd";
import type { Adapter } from "ventyd";
import { User } from "./user";

// Simple in-memory adapter for development
const createInMemoryAdapter = (): Adapter => {
  const events: any[] = [];
  return {
    async getEventsByEntityId({ entityName, entityId }) {
      return events.filter(
        (e) => e.entityName === entityName && e.entityId === entityId,
      );
    },
    async commitEvents({ events: newEvents }) {
      events.push(...newEvents);
    },
  };
};

export const userRepository = createRepository(User, {
  adapter: createInMemoryAdapter(),
});
```

### Step 5: Use It

```typescript
import { User } from "./user";
import { userRepository } from "./user.repository";

// Create
const user = User.create({
  body: { email: "alice@example.com", name: "Alice" },
});

// Mutate
user.updateProfile({ bio: "Software engineer" });

// Save
await userRepository.commit(user);

// Load
const loaded = await userRepository.findOne({ entityId: user.entityId });
console.log(loaded?.name); // "Alice"
console.log(loaded?.bio);  // "Software engineer"
```

## What Happened Under the Hood

1. `User.create()` dispatched a `user:created` event
2. `user.updateProfile()` dispatched a `user:profile_updated` event
3. `userRepository.commit()` saved both events via the adapter
4. `userRepository.findOne()` loaded events and replayed them through the reducer

## Next Steps

For production usage, you'll need:
- A real database adapter (see remote docs: `/docs/database`)
- Plugins for side effects (see remote docs: `/docs/plugins`)
- Testing strategy (see remote docs: `/docs/testing`)
