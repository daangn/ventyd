import type { Reducer } from "./Reducer";
import type {
  InferEntityNameFromSchema,
  InferEventBodyFromSchema,
  InferEventFromSchema,
  InferEventNameFromSchema,
  InferStateFromSchema,
} from "./Schema";

/**
 * Internal interface defining the structure of an Entity instance.
 *
 * @internal
 *
 * @remarks
 * This interface is marked as internal and should not be directly implemented by consumers.
 * Use the `Entity()` factory function to create entity classes.
 *
 * Properties prefixed with ` $$` are considered private implementation details
 * and should not be accessed directly by consumers.
 */
export interface Entity<$$Schema> {
  // ----------------------
  // public properties
  // ----------------------

  /**
   * The canonical name of this entity type.
   * This value is used for event namespacing and storage isolation.
   */
  entityName: InferEntityNameFromSchema<$$Schema>;

  /**
   * The unique identifier for this entity instance.
   * Once set, this value is immutable throughout the entity's lifecycle.
   */
  entityId: string;

  /**
   * The current state of the entity, computed from all applied events.
   *
   * @readonly
   * @throws {Error} If the entity has not been initialized
   */
  get state(): InferStateFromSchema<$$Schema>;

  // ----------------------
  // private properties
  // ----------------------

  /** @internal */
  " $$state": InferStateFromSchema<$$Schema>;
  /** @internal */
  " $$queuedEvents": InferEventFromSchema<$$Schema>[];
  /** @internal */
  " $$reducer": Reducer<$$Schema>;
  /** @internal */
  " $$readonly": boolean;
  /** @internal */
  " $$listeners": (() => void)[];
  /** @internal */
  " $$now": () => Date;

  /**
   * Subscribes to state changes in this entity.
   *
   * @param listener - A callback function that will be invoked whenever the entity's state changes
   * @returns A disposer function that can be called to unsubscribe the listener
   *
   * @remarks
   * The listener is called immediately after each event is dispatched and the state is updated.
   * Multiple listeners can be registered on the same entity.
   */
  subscribe(listener: () => void): () => void;

  // ----------------------
  // private methods
  // ----------------------
  /** @internal */
  " $$dispatch": <K extends InferEventNameFromSchema<$$Schema>>(
    eventName: K,
    body: InferEventBodyFromSchema<$$Schema, K>,
    options?: {
      eventId?: string;
      eventCreatedAt?: string;
    },
  ) => void;

  /** @internal */
  " $$flush": () => void;

  /** @internal */
  " $$createEvent": <EventName extends InferEventNameFromSchema<$$Schema>>(
    eventName: EventName,
    body: InferEventBodyFromSchema<$$Schema, EventName>,
    options?: {
      eventId?: string;
      eventCreatedAt?: string;
    },
  ) => {
    eventId: string;
    eventCreatedAt: string;
    eventName: EventName;
    entityId: string;
    entityName: InferEntityNameFromSchema<$$Schema>;
    body: InferEventBodyFromSchema<$$Schema, EventName>;
  };
}
