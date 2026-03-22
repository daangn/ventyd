/** biome-ignore-all lint/style/noNonNullAssertion: for testing */
/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import { describe, expect, test } from "vitest";
import { prismaAdapter } from "../src/adapter/prisma";

describe("Prisma adapter afterVersion filtering", () => {
  test("should filter events by afterVersion when provided", async () => {
    // Mock Prisma tables
    const mockRows = [
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
      tables: {
        event: {
          findMany: async (args: any) => {
            let rows = mockRows.filter(
              (r) =>
                r.entityName === args?.where?.entityName &&
                r.entityId === args?.where?.entityId,
            );
            // The adapter should filter by afterVersion if provided
            if (args?.where?.version?.gt != null) {
              rows = rows.filter((r) => r.version > args.where.version.gt);
            }
            return rows;
          },
          createMany: async () => ({}),
        },
        snapshot: {
          upsert: async () => ({}),
        },
      },
      entityToRow: ({ entityId, state }) => ({
        id: entityId,
        ...state,
      }),
    });

    // Without afterVersion — should return all events
    const allEvents = await adapter.getEventsByEntityId({
      entityName: "user",
      entityId: "u1",
    });
    expect(allEvents.length).toBe(3);

    // With afterVersion=1 — should return only events with version > 1
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
