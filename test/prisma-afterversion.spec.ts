/** biome-ignore-all lint/style/noNonNullAssertion: for testing */
/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import { describe, expect, test } from "vitest";
import { prismaAdapter } from "../src/adapter/prisma";

function makeAdapter(overrides?: {
  snapshotEvery?: number;
  eventRows?: any[];
  snapshotRow?: any;
}) {
  const mockEventRows = overrides?.eventRows ?? [
    {
      eventId: "e1",
      eventName: "user:created",
      entityId: "u1",
      entityName: "user",
      eventCreatedAt: new Date("2024-01-01"),
      body: { name: "Alice" },
      version: 1,
    },
    {
      eventId: "e2",
      eventName: "user:updated",
      entityId: "u1",
      entityName: "user",
      eventCreatedAt: new Date("2024-01-02"),
      body: { name: "Alice Pro" },
      version: 2,
    },
    {
      eventId: "e3",
      eventName: "user:updated",
      entityId: "u1",
      entityName: "user",
      eventCreatedAt: new Date("2024-01-03"),
      body: { name: "Alice Max" },
      version: 3,
    },
  ];

  const calls = {
    snapshotUpsert: [] as any[],
    viewUpsert: [] as any[],
    eventCreateMany: [] as any[],
  };

  const adapter = prismaAdapter({
    prisma: {
      $transaction: async (commands: any[]) => {
        const results = [];
        for (const cmd of commands) {
          results.push(await cmd);
        }
        return results;
      },
    },
    snapshotEvery: overrides?.snapshotEvery,
    tables: {
      event: {
        findMany: async (args: any) => {
          let rows = mockEventRows.filter(
            (r) =>
              r.entityName === args?.where?.entityName &&
              r.entityId === args?.where?.entityId,
          );
          if (args?.where?.version?.gt != null) {
            rows = rows.filter((r) => r.version > args.where.version.gt);
          }
          return rows;
        },
        createMany: async (args: any) => {
          calls.eventCreateMany.push(args);
          return {};
        },
      },
      snapshot: {
        findFirst: async (_args: any) => overrides?.snapshotRow ?? null,
        upsert: async (args: any) => {
          calls.snapshotUpsert.push(args);
          return {};
        },
      },
      view: {
        upsert: async (args: any) => {
          calls.viewUpsert.push(args);
          return {};
        },
      },
    },
    entityToViewRow: ({ entityId, state }) => ({
      entityId,
      ...state,
    }),
  });

  return { adapter, calls };
}

describe("Prisma adapter afterVersion filtering", () => {
  test("should return all events when afterVersion is not provided", async () => {
    const { adapter } = makeAdapter();

    const allEvents = await adapter.getEventsByEntityId({
      entityName: "user",
      entityId: "u1",
    });
    expect(allEvents.length).toBe(3);
  });

  test("should filter events by afterVersion when provided", async () => {
    const { adapter } = makeAdapter();

    const filteredEvents = await adapter.getEventsByEntityId({
      entityName: "user",
      entityId: "u1",
      afterVersion: 1,
    });
    expect(filteredEvents.length).toBe(2);
    expect((filteredEvents[0] as any).version).toBe(2);
    expect((filteredEvents[1] as any).version).toBe(3);
  });
});

describe("Prisma adapter getSnapshot", () => {
  test("should return null when no snapshot exists", async () => {
    const { adapter } = makeAdapter();

    const snapshot = await adapter.getSnapshot!({
      entityName: "user",
      entityId: "u1",
    });
    expect(snapshot).toBeNull();
  });

  test("should return state and version from snapshot row", async () => {
    const { adapter } = makeAdapter({
      snapshotRow: {
        entityId: "u1",
        entityName: "user",
        version: 10,
        state: { name: "Alice" },
      },
    });

    const snapshot = await adapter.getSnapshot!({
      entityName: "user",
      entityId: "u1",
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.version).toBe(10);
  });
});

describe("Prisma adapter commitEvents", () => {
  test("should always update view table on commit", async () => {
    const { adapter, calls } = makeAdapter();

    await adapter.commitEvents({
      entityName: "user",
      entityId: "u1",
      events: [
        {
          eventId: "e1",
          eventName: "user:created",
          entityId: "u1",
          entityName: "user",
          eventCreatedAt: new Date().toISOString(),
          body: {},
          version: 1,
        },
      ] as any,
      state: { name: "Alice" } as any,
    });

    expect(calls.viewUpsert.length).toBe(1);
    expect(calls.viewUpsert[0].where).toEqual({ entityId: "u1" });
  });

  test("should not save snapshot when snapshotEvery is not set", async () => {
    const { adapter, calls } = makeAdapter();

    await adapter.commitEvents({
      entityName: "user",
      entityId: "u1",
      events: [
        {
          eventId: "e1",
          eventName: "user:created",
          entityId: "u1",
          entityName: "user",
          eventCreatedAt: new Date().toISOString(),
          body: {},
          version: 5,
        },
      ] as any,
      state: { name: "Alice" } as any,
    });

    expect(calls.snapshotUpsert.length).toBe(0);
  });

  test("should save snapshot when version is a multiple of snapshotEvery", async () => {
    const { adapter, calls } = makeAdapter({ snapshotEvery: 5 });

    await adapter.commitEvents({
      entityName: "user",
      entityId: "u1",
      events: [
        {
          eventId: "e5",
          eventName: "user:updated",
          entityId: "u1",
          entityName: "user",
          eventCreatedAt: new Date().toISOString(),
          body: {},
          version: 5,
        },
      ] as any,
      state: { name: "Alice" } as any,
    });

    expect(calls.snapshotUpsert.length).toBe(1);
    expect(calls.snapshotUpsert[0].where).toEqual({ entityId: "u1" });
  });

  test("should not save snapshot when version is not a multiple of snapshotEvery", async () => {
    const { adapter, calls } = makeAdapter({ snapshotEvery: 5 });

    await adapter.commitEvents({
      entityName: "user",
      entityId: "u1",
      events: [
        {
          eventId: "e3",
          eventName: "user:updated",
          entityId: "u1",
          entityName: "user",
          eventCreatedAt: new Date().toISOString(),
          body: {},
          version: 3,
        },
      ] as any,
      state: { name: "Alice" } as any,
    });

    expect(calls.snapshotUpsert.length).toBe(0);
  });
});
