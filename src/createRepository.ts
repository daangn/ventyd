import sortBy from "just-sort-by";
import type {
  Adapter,
  BaseEventType,
  ConstructorReturnType,
  DefaultSchema,
  Entity,
  EntityConstructor,
  InferEntityNameFromSchema,
  InferSchemaFromEntityConstructor,
  Plugin,
  Repository,
} from "./types";

/**
 * Creates a repository instance for managing entity persistence.
 *
 * @param Entity - The entity class created with `class MyEntity extends Entity()`
 * @param args - Repository configuration
 * @param args.adapter - The adapter implementation for persistence
 * @param args.plugins - Optional array of plugins to extend repository behavior
 * @param args.onPluginError - Optional callback to handle plugin execution errors
 *
 * @returns A repository instance with type-safe operations
 *
 * @remarks
 * The repository serves as the bridge between your domain entities and the
 * underlying persistence mechanism. It ensures that all persistence operations
 * maintain the integrity of the event sourcing pattern.
 *
 * ```
 * Entity → dispatch() → queuedEvents → commit() → Adapter → Plugins
 * ```
 *
 * ## Plugin Execution
 *
 * Plugins run after events are committed to storage:
 * - All plugins execute in parallel using Promise.allSettled
 * - Plugin failures don't affect the commit operation (events are already saved)
 * - Plugin failures don't prevent other plugins from running
 * - Use `onPluginError` to handle plugin failures
 *
 * @example
 * ### Basic Usage
 *
 * ```typescript
 * import { createRepository, Entity, defineSchema, defineReducer } from 'ventyd';
 * import type { Adapter } from 'ventyd';
 *
 * // Define your entity
 * const userSchema = defineSchema("user", {...});
 * const userReducer = defineReducer(userSchema, ...);
 * class User extends Entity(userSchema, userReducer) {
 *   // ...
 * }
 *
 * // Create adapter implementation
 * const adapter: Adapter = {
 *   async getEventsByEntityId({ entityName, entityId }) {
 *     // Implementation for retrieving events
 *   },
 *   async commitEvents({ events }) {
 *     // Implementation for storing events
 *   }
 * };
 *
 * // Create repository with adapter
 * const userRepository = createRepository(User, {
 *   adapter: adapter
 * });
 *
 * // Use the repository
 * const user = await userRepository.findOne({ entityId: 'user-123' });
 * ```
 *
 * @example
 * ### Using Plugins
 *
 * ```typescript
 * import type { Plugin } from 'ventyd';
 *
 * const analyticsPlugin: Plugin = {
 *   async onCommitted({ events }) {
 *     await analytics.track(events);
 *   }
 * };
 *
 * const auditPlugin: Plugin = {
 *   async onCommitted({ entityName, entityId, state }) {
 *     await auditLog.record({ entityName, entityId, state });
 *   }
 * };
 *
 * const userRepository = createRepository(User, {
 *   adapter,
 *   plugins: [analyticsPlugin, auditPlugin]
 * });
 * ```
 *
 * @example
 * ### Handling Plugin Errors
 *
 * ```typescript
 * const userRepository = createRepository(User, {
 *   adapter,
 *   plugins: [analyticsPlugin, notificationPlugin],
 *   onPluginError: (error, plugin) => {
 *     // Log error
 *     logger.error('Plugin execution failed', {
 *       error: error instanceof Error ? error.message : String(error),
 *       pluginName: plugin.constructor.name
 *     });
 *
 *     // Send to error tracking service
 *     sentry.captureException(error, {
 *       tags: { component: 'plugin' }
 *     });
 *   }
 * });
 * ```
 */
export function createRepository<
  $$EntityConstructor extends EntityConstructor<
    InferSchemaFromEntityConstructor<$$EntityConstructor>
  >,
>(
  Entity: $$EntityConstructor,
  args: {
    adapter: Adapter<InferSchemaFromEntityConstructor<$$EntityConstructor>>;
    plugins?: Plugin<InferSchemaFromEntityConstructor<$$EntityConstructor>>[];
    onPluginError?: (
      error: unknown,
      plugin: Plugin<InferSchemaFromEntityConstructor<$$EntityConstructor>>,
    ) => void;
    /**
     * Optional function to upcast legacy events before schema validation.
     *
     * @remarks
     * Use this to migrate old event versions stored in the database into the
     * current event format, without needing to keep legacy schemas registered.
     * The function runs on each raw event before `parseEvent` validation, so
     * only current event names need to be registered in the schema.
     *
     * @example
     * ```typescript
     * const userRepository = createRepository(User, {
     *   adapter,
     *   migrate(rawEvent) {
     *     if (rawEvent.eventName === "user:profile_updated_v1") {
     *       return { ...rawEvent, eventName: "user:profile_updated" };
     *     }
     *     return rawEvent;
     *   },
     * });
     * ```
     */
    migrate?: (rawEvent: BaseEventType) => BaseEventType;
    /**
     * Optional snapshot configuration for optimizing entity loading.
     *
     * @remarks
     * When configured, the repository will periodically save entity state snapshots
     * to avoid replaying all events from the beginning. Requires the adapter to
     * implement `getSnapshot` and `saveSnapshot` methods.
     */
    snapshot?: {
      /**
       * Save a snapshot every N events.
       * For example, `frequency: 100` saves a snapshot when the entity version
       * is a multiple of 100.
       */
      frequency: number;
    };
  },
): Repository<ConstructorReturnType<$$EntityConstructor>> {
  type $$Schema = InferSchemaFromEntityConstructor<$$EntityConstructor>;
  type $$EntityName = InferEntityNameFromSchema<$$Schema>;
  type $$ExtendedEntityType = ConstructorReturnType<$$EntityConstructor>;

  const _schema = Entity.schema as DefaultSchema;
  const entityName = _schema[" $$entityName"] as $$EntityName;

  return {
    async findOne({ entityId }) {
      // 1. try to load snapshot if adapter supports it
      let snapshot: {
        state: ReturnType<typeof _schema.parseEvent>;
        version: number;
      } | null = null;
      if (args.adapter.getSnapshot) {
        snapshot = await args.adapter.getSnapshot({
          entityName: entityName as string,
          entityId,
        });
      }

      // 2. query events by entity ID (after snapshot version if available)
      const rawEvents = await args.adapter.getEventsByEntityId({
        entityName: entityName as string,
        entityId,
        afterVersion: snapshot?.version,
      });

      // 3. migrate + validate and sort events from adapter using the schema
      const migrate = args.migrate ?? ((e) => e);
      const migratedEvents = rawEvents
        .map((e) => e as BaseEventType)
        .map(migrate) as typeof rawEvents;

      for (const event of migratedEvents) {
        _schema.parseEvent(event);
      }
      const events = sortBy(migratedEvents, (e) => {
        const ev = e as BaseEventType;
        return ev.version != null ? ev.version : ev.eventCreatedAt;
      });

      // 4. if no snapshot and no events, entity doesn't exist
      if (!snapshot && events.length === 0) {
        return null;
      }

      // 5. load entity from events (with optional snapshot)
      const entity = Entity[" $$loadFromEvents"]({
        entityId,
        events,
        snapshot: snapshot ?? undefined,
      });

      return entity as $$ExtendedEntityType;
    },
    async commit(entity) {
      // 0. prepare
      const _entity = entity as Entity<$$Schema>;

      // 1. copy queued events
      const queuedEvents = _entity[" $$flush"]();

      // 2. commit events to adapter
      const expectedVersion =
        _entity[" $$version"] - queuedEvents.length;
      await args.adapter.commitEvents({
        entityName,
        entityId: _entity.entityId,
        events: queuedEvents,
        state: _entity.state,
        expectedVersion,
      });

      // 3. save snapshot if configured and adapter supports it
      if (
        args.snapshot?.frequency &&
        args.adapter.saveSnapshot &&
        queuedEvents.length > 0 &&
        _entity[" $$version"] % args.snapshot.frequency === 0
      ) {
        await args.adapter.saveSnapshot({
          entityName,
          entityId: _entity.entityId,
          state: _entity.state,
          version: _entity[" $$version"],
        });
      }

      // 4. run plugins in parallel (only if there are events)
      if (args.plugins && args.plugins.length > 0 && queuedEvents.length > 0) {
        const pluginResults = await Promise.allSettled(
          args.plugins.map((plugin) =>
            // Wrap in async function to catch both sync and async errors
            (async () => {
              return await plugin.onCommitted?.({
                entityName,
                entityId: _entity.entityId,
                events: queuedEvents,
                state: _entity.state,
              });
            })(),
          ),
        );

        // Handle plugin errors if callback is provided
        if (args.onPluginError) {
          pluginResults.forEach((pluginResult, i) => {
            const plugin = args.plugins?.[i];

            if (pluginResult.status === "rejected" && plugin) {
              args.onPluginError?.(pluginResult.reason, plugin);
            }
          });
        }
      }
    },
  };
}
