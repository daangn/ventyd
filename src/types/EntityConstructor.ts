import type { Entity } from "./Entity";
import type { ReadonlyEntity } from "./ReadonlyEntity";
import type {
  InferEventFromSchema,
  InferInitialEventBodyFromSchema,
  InferStateFromSchema,
} from "./Schema";

/**
 * Arguments for entity constructor.
 *
 * @remarks
 * Supports three initialization modes:
 * - `create`: Create a new entity with initial event
 * - `load`: Load entity with pre-computed state (readonly)
 * - `loadFromEvents`: Load entity by replaying events
 *
 * @internal
 */
export type EntityConstructorArgs<$$Schema> =
  | {
      type: "create";
      body: InferInitialEventBodyFromSchema<$$Schema>;
      entityId?: string;
      eventId?: string;
      eventCreatedAt?: string;
    }
  | {
      type: "load";
      entityId: string;
      state: InferStateFromSchema<$$Schema>;
      UNSAFE_mutable?: true;
    }
  | {
      type: "loadFromEvents";
      entityId: string;
      events: InferEventFromSchema<$$Schema>[];
    };

/**
 * Internal interface defining the constructor for an Entity instance.
 *
 * @internal
 */
export interface EntityConstructor<$$Schema> {
  /**
   * The schema defining the entity's structure and event types
   **/
  schema: $$Schema;

  /**
   * Creates a new entity instance by dispatching the initial event.
   *
   * @param args - Creation parameters
   * @param args.body - The initial event body as defined in your schema
   * @param args.entityId - Optional custom entity ID (auto-generated if not provided)
   * @param args.eventId - Optional custom event ID (auto-generated if not provided)
   * @param args.eventCreatedAt - Optional custom ISO timestamp (defaults to current time)
   * @returns A new entity instance in a mutable state, ready to dispatch events
   *
   * @remarks
   * This is the primary method for creating new entities in your domain. It:
   *
   * 1. Generates a unique entity ID (or uses the provided one)
   * 2. Creates and validates the initial event
   * 3. Dispatches the event to compute the initial state
   * 4. Returns a fully initialized, mutable entity instance
   *
   * The created entity can immediately dispatch additional events and has full
   * mutation capabilities. All queued events can be persisted using `repository.commit()`.
   *
   * ## ID Generation
   *
   * By default, entity IDs are generated using `crypto.randomUUID()`. You can:
   * - Provide a custom `entityId` in the args
   * - Configure a custom ID generator in `defineSchema()`
   *
   * ## Event Validation
   *
   * The initial event is validated against your schema before being dispatched.
   * If validation fails, an error is thrown and the entity is not created.
   *
   * ## Use Cases
   *
   * - **User Registration**: Create user entities with email and initial profile
   * - **Order Placement**: Create order entities with initial line items
   * - **Document Creation**: Create document entities with initial content
   * - **Account Opening**: Create account entities with initial balance
   *
   * @example
   * ### Basic Creation
   * ```typescript
   * const user = User.create({
   *   body: {
   *     email: "alice@example.com",
   *     nickname: "Alice"
   *   }
   * });
   *
   * console.log(user.entityId); // Auto-generated UUID
   * console.log(user.state); // { email: "alice@...", nickname: "Alice", ... }
   * ```
   *
   * @example
   * ### Custom Entity ID
   * ```typescript
   * const user = User.create({
   *   entityId: "user-alice-2024",
   *   body: {
   *     email: "alice@example.com",
   *     nickname: "Alice"
   *   }
   * });
   *
   * console.log(user.entityId); // "user-alice-2024"
   * ```
   *
   * @example
   * ### With Custom Timestamps (for event replay/migration)
   * ```typescript
   * const user = User.create({
   *   entityId: "user-123",
   *   eventId: "evt-456",
   *   eventCreatedAt: "2024-01-15T10:30:00.000Z",
   *   body: {
   *     email: "alice@example.com",
   *     nickname: "Alice"
   *   }
   * });
   * ```
   *
   * @example
   * ### Creating and Persisting
   * ```typescript
   * // Create entity
   * const user = User.create({
   *   body: {
   *     email: "alice@example.com",
   *     nickname: "Alice"
   *   }
   * });
   *
   * // Make additional changes
   * user.updateProfile({ bio: "Software Engineer" });
   * user.verify({ verifiedAt: new Date().toISOString() });
   *
   * // Persist all queued events (initial + mutations)
   * await userRepository.commit(user);
   * ```
   *
   * @throws Will throw if the initial event fails schema validation
   */
  create: <T>(
    this: new (
      args: EntityConstructorArgs<$$Schema>,
    ) => T,
    args: {
      body: InferInitialEventBodyFromSchema<$$Schema>;
      entityId?: string;
      eventId?: string;
      eventCreatedAt?: string;
    },
  ) => T;

  /**
   * Loads an entity instance with the given state.
   *
   * @remarks
   * By default, loaded entities are read-only and cannot dispatch events.
   * This enforces CQRS (Command-Query Responsibility Segregation) by separating
   * write operations (create/hydrate) from read operations (load from state).
   *
   * Use the `UNSAFE_mutable` option to create a mutable entity from state.
   * This bypasses event sourcing integrity and should only be used in specific
   * scenarios like migrations or testing.
   *
   * @example
   * ```typescript
   * // Read-only entity (default)
   * const user = User.load({
   *   entityId: "user-123",
   *   state: { nickname: "John", email: "john@example.com" }
   * });
   * user.updateProfile({ bio: "..." }); // Error: Entity is readonly
   *
   * // Mutable entity (use with caution)
   * const mutableUser = User.load({
   *   entityId: "user-123",
   *   state: { nickname: "John", email: "john@example.com" },
   *   UNSAFE_mutable: true
   * });
   * mutableUser.updateProfile({ bio: "..." }); // Works
   * ```
   */
  load<T>(
    this: new (
      args: EntityConstructorArgs<$$Schema>,
    ) => T,
    args: {
      entityId: string;
      state: InferStateFromSchema<$$Schema>;
      UNSAFE_mutable: true;
    },
  ): T;
  load<T extends Entity<$$Schema>>(
    this: new (
      args: EntityConstructorArgs<$$Schema>,
    ) => T,
    args: {
      entityId: string;
      state: InferStateFromSchema<$$Schema>;
    },
  ): ReadonlyEntity<T>;

  /**
   * @internal
   */
  " $$loadFromEvents": <T extends Entity<$$Schema>>(
    this: new (
      args: EntityConstructorArgs<$$Schema>,
    ) => T,
    args: {
      events: InferEventFromSchema<$$Schema>[];
      entityId: string;
    },
  ) => T;

  /**
   * @internal
   */
  new (args: EntityConstructorArgs<$$Schema>): Entity<$$Schema>;
}

/**
 * Infer the schema from an entity constructor.
 * @internal
 */
export type InferSchemaFromEntityConstructor<T> = T extends {
  schema: infer $$Schema;
}
  ? $$Schema
  : never;
