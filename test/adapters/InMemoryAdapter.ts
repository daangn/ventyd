/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import type { Adapter } from "../../src";

type BaseEvent = {
  eventId: string;
  eventName: `${string}:${string}`;
  eventCreatedAt: string;
  entityName: string;
  entityId: string;
  body: {};
  version?: number;
};

/**
 * In-memory adapter implementation for testing purposes.
 * This adapter keeps all events in memory using a Map structure.
 */
export const createInMemoryAdapter = (): InMemoryAdapter => {
  const events: Map<string, BaseEvent[]> = new Map();
  const snapshots: Map<string, { state: any; version: number }> = new Map();

  const adapter: Adapter = {
    /**
     * Retrieves all events for a specific entity.
     */
    async getEventsByEntityId(args: {
      entityName: string;
      entityId: string;
      afterVersion?: number;
    }): Promise<BaseEvent[]> {
      const key = `${args.entityName}:${args.entityId}`;
      const allEvents = events.get(key) || [];
      if (args.afterVersion != null) {
        return allEvents.filter(
          (e) => e.version != null && e.version > args.afterVersion!,
        );
      }
      return allEvents;
    },

    /**
     * Commits new events to the adapter.
     */
    async commitEvents(args: {
      entityName: string;
      entityId: string;
      events: BaseEvent[];
      state: any;
      expectedVersion?: number;
    }): Promise<void> {
      for (const event of args.events) {
        const key = `${event.entityName}:${event.entityId}`;
        const existing = events.get(key) || [];
        events.set(key, [...existing, event]);
      }
    },

    /**
     * Retrieves the latest snapshot for a specific entity.
     */
    async getSnapshot(args: {
      entityName: string;
      entityId: string;
    }): Promise<{ state: any; version: number } | null> {
      const key = `${args.entityName}:${args.entityId}`;
      return snapshots.get(key) || null;
    },

    /**
     * Saves a snapshot of the entity's current state.
     */
    async saveSnapshot(args: {
      entityName: string;
      entityId: string;
      state: any;
      version: number;
    }): Promise<void> {
      const key = `${args.entityName}:${args.entityId}`;
      snapshots.set(key, { state: args.state, version: args.version });
    },
  };

  return {
    ...adapter,
    /**
     * Utility method to clear all events and snapshots (useful for test cleanup).
     */
    clear(): void {
      events.clear();
      snapshots.clear();
    },

    /**
     * Utility method to get all stored events (useful for debugging tests).
     */
    getAllEvents(): BaseEvent[] {
      const allEvents: BaseEvent[] = [];
      for (const evts of events.values()) {
        allEvents.push(...evts);
      }
      return allEvents;
    },

    /**
     * Utility method to get the count of events for a specific entity.
     */
    getEventCount(entityName: string, entityId: string): number {
      const key = `${entityName}:${entityId}`;
      return events.get(key)?.length || 0;
    },

    /**
     * Utility method to get a stored snapshot (useful for debugging tests).
     */
    getStoredSnapshot(
      entityName: string,
      entityId: string,
    ): { state: any; version: number } | null {
      const key = `${entityName}:${entityId}`;
      return snapshots.get(key) || null;
    },
  };
};

export type InMemoryAdapter = Adapter & {
  clear(): void;
  getAllEvents(): BaseEvent[];
  getEventCount(entityName: string, entityId: string): number;
  getStoredSnapshot(
    entityName: string,
    entityId: string,
  ): { state: any; version: number } | null;
};
