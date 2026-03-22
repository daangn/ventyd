/** biome-ignore-all lint/style/noNonNullAssertion: for testing */
/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import { describe, expect, test } from "vitest";
import type { BaseEventType } from "../src";
import { createRepository } from "../src";
import { createInMemoryAdapter } from "./adapters/InMemoryAdapter";
import { User } from "./entities/User";

describe("Event Versioning", () => {
  describe("Version tracking on create", () => {
    test("should set version to 1 on initial event", () => {
      const user = User.create({
        body: {
          nickname: "Alice",
          email: "alice@example.com",
        },
      });

      expect(user.version).toBe(1);

      const event = user[" $$queuedEvents"][0] as BaseEventType;
      expect(event.version).toBe(1);
    });

    test("should increment version for each dispatched event", () => {
      const user = User.create({
        body: {
          nickname: "Bob",
          email: "bob@example.com",
        },
      });

      user.updateProfile({ bio: "Developer" });
      user.updateProfile({ nickname: "Bob Updated" });
      user.delete("Leaving");

      expect(user.version).toBe(4);

      const events = user[" $$queuedEvents"] as BaseEventType[];
      expect(events[0]!.version).toBe(1); // created
      expect(events[1]!.version).toBe(2); // profile_updated
      expect(events[2]!.version).toBe(3); // profile_updated
      expect(events[3]!.version).toBe(4); // deleted
    });
  });

  describe("Version tracking on load", () => {
    test("should default version to 0 when not provided", () => {
      const user = User.load({
        entityId: "user-123",
        state: {
          nickname: "Charlie",
          email: "charlie@example.com",
          bio: undefined,
          deletedAt: null,
        },
      });

      expect(user.version).toBe(0);
    });

    test("should use provided version on load", () => {
      const user = User.load({
        entityId: "user-123",
        state: {
          nickname: "Charlie",
          email: "charlie@example.com",
          bio: undefined,
          deletedAt: null,
        },
        version: 5,
      });

      expect(user.version).toBe(5);
    });

    test("should continue versioning from loaded version on mutable entity", () => {
      const user = User.load({
        entityId: "user-123",
        state: {
          nickname: "Dave",
          email: "dave@example.com",
          bio: undefined,
          deletedAt: null,
        },
        version: 3,
        UNSAFE_mutable: true,
      });

      expect(user.version).toBe(3);

      user.updateProfile({ bio: "Engineer" });
      expect(user.version).toBe(4);

      const event = user[" $$queuedEvents"][0] as BaseEventType;
      expect(event.version).toBe(4);
    });
  });

  describe("Version tracking on loadFromEvents", () => {
    test("should set version from last event", () => {
      const events = [
        {
          eventId: "evt-1",
          eventName: "user:created" as const,
          eventCreatedAt: "2024-01-01T00:00:00Z",
          entityId: "user-789",
          entityName: "user",
          body: { nickname: "Eve", email: "eve@example.com" },
          version: 1,
        },
        {
          eventId: "evt-2",
          eventName: "user:profile_updated" as const,
          eventCreatedAt: "2024-01-01T01:00:00Z",
          entityId: "user-789",
          entityName: "user",
          body: { bio: "Designer" },
          version: 2,
        },
      ];

      const user = User[" $$loadFromEvents"]({
        entityId: "user-789",
        events,
      });

      expect(user.version).toBe(2);
    });

    test("should handle events without version (legacy)", () => {
      const events = [
        {
          eventId: "evt-1",
          eventName: "user:created" as const,
          eventCreatedAt: "2024-01-01T00:00:00Z",
          entityId: "user-789",
          entityName: "user",
          body: { nickname: "Legacy", email: "legacy@example.com" },
        },
      ];

      const user = User[" $$loadFromEvents"]({
        entityId: "user-789",
        events,
      });

      // Version stays at 0 since events don't have version
      expect(user.version).toBe(0);
    });
  });

  describe("Version in flush and commit flow", () => {
    test("should preserve version after flush", () => {
      const user = User.create({
        body: {
          nickname: "Frank",
          email: "frank@example.com",
        },
      });

      user.updateProfile({ bio: "Manager" });
      expect(user.version).toBe(2);

      user[" $$flush"]();
      expect(user.version).toBe(2); // version should NOT reset
      expect(user[" $$queuedEvents"].length).toBe(0);
    });

    test("should pass expectedVersion to adapter on commit", async () => {
      const adapter = createInMemoryAdapter();
      const userRepository = createRepository(User, { adapter });

      const user = User.create({
        body: {
          nickname: "Grace",
          email: "grace@example.com",
        },
      });

      user.updateProfile({ bio: "CTO" });

      // version is 2, queued events count is 2
      // expectedVersion should be 0 (2 - 2)
      let capturedExpectedVersion: number | undefined;
      const originalCommit = adapter.commitEvents.bind(adapter);
      adapter.commitEvents = async (args: any) => {
        capturedExpectedVersion = args.expectedVersion;
        return originalCommit(args);
      };

      await userRepository.commit(user);
      expect(capturedExpectedVersion).toBe(0);
    });

    test("should calculate correct expectedVersion for subsequent commits", async () => {
      const adapter = createInMemoryAdapter();
      const userRepository = createRepository(User, { adapter });

      const user = User.create({
        body: {
          nickname: "Hank",
          email: "hank@example.com",
        },
      });

      await userRepository.commit(user);

      // Now load and update
      const loaded = await userRepository.findOne({
        entityId: user.entityId,
      });
      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe(1);
    });
  });

  describe("Version in repository findOne", () => {
    test("should reconstruct version from stored events", async () => {
      const adapter = createInMemoryAdapter();
      const userRepository = createRepository(User, { adapter });

      const user = User.create({
        body: {
          nickname: "Iris",
          email: "iris@example.com",
        },
      });

      user.updateProfile({ bio: "Architect" });
      user.updateProfile({ nickname: "Iris Pro" });

      await userRepository.commit(user);

      const loaded = await userRepository.findOne({
        entityId: user.entityId,
      });

      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe(3);
      expect(loaded!.nickname).toBe("Iris Pro");
    });

    test("should sort events by version", async () => {
      const adapter = createInMemoryAdapter();
      const userRepository = createRepository(User, { adapter });

      const user = User.create({
        body: {
          nickname: "Jake",
          email: "jake@example.com",
        },
      });

      user.updateProfile({ bio: "v2" });
      user.updateProfile({ bio: "v3" });

      await userRepository.commit(user);

      const loaded = await userRepository.findOne({
        entityId: user.entityId,
      });

      expect(loaded!.version).toBe(3);
      expect(loaded!.bio).toBe("v3");
    });
  });

  describe("Version with multiple commits", () => {
    test("should maintain version across multiple commit cycles", async () => {
      const adapter = createInMemoryAdapter();
      const userRepository = createRepository(User, { adapter });

      // Create and commit
      const user = User.create({
        body: {
          nickname: "Kate",
          email: "kate@example.com",
        },
      });
      await userRepository.commit(user);

      // Load, update, commit
      const loaded1 = (await userRepository.findOne({
        entityId: user.entityId,
      }))!;
      expect(loaded1.version).toBe(1);

      // Load as mutable for further updates
      const mutable = User.load({
        entityId: user.entityId,
        state: loaded1.state,
        version: loaded1.version,
        UNSAFE_mutable: true,
      });

      mutable.updateProfile({ bio: "Engineer" });
      mutable.updateProfile({ nickname: "Kate Pro" });

      expect(mutable.version).toBe(3);

      await userRepository.commit(mutable);

      // Load again and verify
      const loaded2 = (await userRepository.findOne({
        entityId: user.entityId,
      }))!;
      expect(loaded2.version).toBe(3);
      expect(loaded2.nickname).toBe("Kate Pro");
      expect(loaded2.bio).toBe("Engineer");
    });
  });
});
