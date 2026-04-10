# Common Errors and Solutions

## TypeScript Configuration

### Error: Type inference not working / implicit any errors

**Symptom:** Types are `any`, no autocomplete, type errors throughout.

**Cause:** TypeScript `strict` mode is not enabled.

**Solution:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

Ventyd requires TypeScript 5.0+ with `strict: true`.

---

## Schema Definition

### Error: "initialEventName does not match any event"

**Symptom:** Type error on `initialEventName` field in `defineSchema()`.

**Cause:** `initialEventName` must be fully qualified with the entity name prefix.

```typescript
// Wrong
defineSchema("user", {
  schema: valibot({ event: { created: v.object({...}) }, state: ... }),
  initialEventName: "created", // Missing entity prefix
});

// Correct
defineSchema("user", {
  schema: valibot({ event: { created: v.object({...}) }, state: ... }),
  initialEventName: "user:created", // Fully qualified
});
```

### Error: Event name not recognized in reducer

**Symptom:** `event.eventName` doesn't match any case in switch statement.

**Cause:** Event names are auto-prefixed. In the schema you define `created`, but in the reducer you must match `user:created`.

```typescript
// Schema defines short names
event: { created: v.object({...}), profile_updated: v.object({...}) }

// Reducer uses prefixed names
switch (event.eventName) {
  case "user:created":          // Not "created"
  case "user:profile_updated":  // Not "profile_updated"
}
```

### Error: Schema validation failed on event body

**Symptom:** Runtime error when dispatching an event — validation rejects the body.

**Cause:** The event body doesn't match the schema definition.

**Solution:** Check that the data passed to `dispatch()` matches the schema exactly. Use the validation library's error messages to identify the mismatch.

---

## Reducer

### Error: State is undefined after event replay

**Symptom:** `entity.state` is `undefined` or missing fields after loading.

**Cause:** Reducer doesn't handle the `default` case, or doesn't return `prevState`.

```typescript
// Wrong — missing default case
const reducer = defineReducer(schema, (prevState, event) => {
  switch (event.eventName) {
    case "user:created":
      return { ... };
    // No default! Unknown events return undefined
  }
});

// Correct
const reducer = defineReducer(schema, (prevState, event) => {
  switch (event.eventName) {
    case "user:created":
      return { ... };
    default:
      return prevState; // Always return previous state for unknown events
  }
});
```

### Error: State mutation detected / unexpected state changes

**Symptom:** State changes unexpectedly between operations.

**Cause:** Reducer is mutating `prevState` instead of returning a new object.

```typescript
// Wrong — mutates prevState
case "user:profile_updated":
  prevState.bio = event.body.bio; // Mutation!
  return prevState;

// Correct — returns new object
case "user:profile_updated":
  return { ...prevState, bio: event.body.bio };
```

---

## Entity

### Error: "Cannot read properties of undefined (reading 'dispatch')"

**Symptom:** Runtime error when calling a mutation method.

**Cause:** Using `$$dispatch` directly instead of the `mutation()` helper.

```typescript
// Wrong
class User extends Entity(schema, reducer) {
  updateProfile(updates) {
    this.$$dispatch("user:profile_updated", updates);
  }
}

// Correct — use mutation() helper
class User extends Entity(schema, reducer) {
  updateProfile = mutation(this, (dispatch, updates) => {
    dispatch("user:profile_updated", updates);
  });
}
```

### Error: "Property 'updateProfile' does not exist" on loaded entity

**Symptom:** Type error when calling mutations on an entity from `repository.findOne()` or `Entity.load()`.

**Cause:** `Entity.load()` returns a `ReadonlyEntity` — mutations are stripped at the type level. This is by design (CQRS pattern).

```typescript
// Entity.load() returns readonly
const user = User.load({ entityId: "...", state: {...} });
user.updateProfile({ bio: "..." }); // Type error! ReadonlyEntity

// repository.findOne() returns mutable
const user = await repo.findOne({ entityId: "..." });
user?.updateProfile({ bio: "..." }); // OK

// Escape hatch (use with caution)
const user = User.load({ entityId: "...", state: {...}, UNSAFE_mutable: true });
user.updateProfile({ bio: "..." }); // OK but bypasses CQRS safety
```

---

## Repository

### Error: Plugin errors silently swallowed

**Symptom:** Plugin `onCommitted` fails but no error is visible.

**Cause:** Plugin errors are silently ignored by default to protect the main business flow.

**Solution:** Add `onPluginError` callback:

```typescript
const repository = createRepository(User, {
  adapter,
  plugins: [myPlugin],
  onPluginError: (error, plugin) => {
    console.error("Plugin failed:", error);
    // Log to error tracking service
  },
});
```

### Error: Events committed but entity state doesn't match after reload

**Symptom:** After `commit()` and `findOne()`, the entity state is different.

**Cause:** Adapter's `getEventsByEntityId` doesn't return events in chronological order.

**Solution:** Ensure your adapter returns events sorted by creation time (oldest first):

```typescript
async getEventsByEntityId({ entityName, entityId }) {
  return await db.query(
    "SELECT * FROM events WHERE entity_name = ? AND entity_id = ? ORDER BY created_at ASC",
    [entityName, entityId]
  );
}
```

---

## Validation Libraries

### Error: "Cannot find module 'ventyd/valibot'"

**Symptom:** Import error for validation library integration.

**Cause:** The validation library peer dependency is not installed.

**Solution:** Install both ventyd and your chosen validation library:

```bash
# Valibot
npm install ventyd valibot

# Zod
npm install ventyd zod

# ArkType
npm install ventyd arktype

# TypeBox
npm install ventyd typebox
```

---

## Business Logic

### Anti-pattern: Dispatching events without validation

**Symptom:** Invalid events enter the event store, causing corrupted state.

**Cause:** Business rules not validated before `dispatch()`.

```typescript
// Wrong — no validation before dispatch
updateProfile = mutation(this, (dispatch, updates) => {
  dispatch("user:profile_updated", updates); // What if user is deleted?
});

// Correct — validate first, then dispatch
updateProfile = mutation(this, (dispatch, updates) => {
  if (this.isDeleted) {
    throw new Error("Cannot update profile of deleted user");
  }
  dispatch("user:profile_updated", updates);
});
```
