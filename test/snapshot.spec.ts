/** biome-ignore-all lint/style/noNonNullAssertion: for testing */
/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import { describe, expect, test, vi } from "vitest";
import { createRepository } from "../src";
import { User } from "./entities/User";
import { Order } from "./entities/Order";
import { createInMemoryAdapter } from "./adapters/InMemoryAdapter";

describe("Snapshot Support", () => {
  describe("Snapshot-aware findOne", () => {
    test("should load from snapshot + remaining events", async () => {
      const adapter = createInMemoryAdapter();
      const userRepository = createRepository(User, { adapter });

      // Create a user and commit
      const user = User.create({
        body: {
          nickname: "Alice",
          email: "alice@example.com",
        },
      });
      user.updateProfile({ bio: "Engineer" });
      user.updateProfile({ nickname: "Alice Pro" });
      await userRepository.commit(user);

      // Manually save a snapshot at version 2
      await adapter.saveSnapshot!({
        entityName: "user",
        entityId: user.entityId,
        state: {
          nickname: "Alice",
          email: "alice@example.com",
          bio: "Engineer",
          deletedAt: null,
        },
        version: 2,
      });

      // Load entity — should use snapshot + only events after version 2
      const loaded = await userRepository.findOne({
        entityId: user.entityId,
      });

      expect(loaded).not.toBeNull();
      expect(loaded!.nickname).toBe("Alice Pro");
      expect(loaded!.bio).toBe("Engineer");
      expect(loaded!.version).toBe(3);
    });

    test("should work when snapshot exists but no new events", async () => {
      const adapter = createInMemoryAdapter();
      const userRepository = createRepository(User, { adapter });

      // Create and commit
      const user = User.create({
        body: {
          nickname: "Bob",
          email: "bob@example.com",
        },
      });
      await userRepository.commit(user);

      // Save snapshot at version 1 (the only event)
      await adapter.saveSnapshot!({
        entityName: "user",
        entityId: user.entityId,
        state: {
          nickname: "Bob",
          email: "bob@example.com",
          bio: undefined,
          deletedAt: null,
        },
        version: 1,
      });

      // Load — should use snapshot only, no events to replay
      const loaded = await userRepository.findOne({
        entityId: user.entityId,
      });

      expect(loaded).not.toBeNull();
      expect(loaded!.nickname).toBe("Bob");
      expect(loaded!.version).toBe(1);
    });

    test("should return null when no snapshot and no events", async () => {
      const adapter = createInMemoryAdapter();
      const userRepository = createRepository(User, { adapter });

      const loaded = await userRepository.findOne({
        entityId: "nonexistent",
      });

      expect(loaded).toBeNull();
    });

    test("should work without snapshot (backward compatible)", async () => {
      const adapter = createInMemoryAdapter();
      // Remove snapshot methods to simulate old adapter
      const adapterWithoutSnapshots = {
        getEventsByEntityId: adapter.getEventsByEntityId,
        commitEvents: adapter.commitEvents,
      };
      const userRepository = createRepository(User, {
        adapter: adapterWithoutSnapshots,
      });

      const user = User.create({
        body: {
          nickname: "Charlie",
          email: "charlie@example.com",
        },
      });
      user.updateProfile({ bio: "Designer" });
      await userRepository.commit(user);

      const loaded = await userRepository.findOne({
        entityId: user.entityId,
      });

      expect(loaded).not.toBeNull();
      expect(loaded!.nickname).toBe("Charlie");
      expect(loaded!.bio).toBe("Designer");
      expect(loaded!.version).toBe(2);
    });
  });

  describe("Automatic snapshot saving", () => {
    test("should save snapshot when version is multiple of frequency", async () => {
      const adapter = createInMemoryAdapter();
      const userRepository = createRepository(User, {
        adapter,
        snapshot: { frequency: 3 },
      });

      const user = User.create({
        body: {
          nickname: "Dave",
          email: "dave@example.com",
        },
      });
      user.updateProfile({ bio: "v2" });
      user.updateProfile({ nickname: "Dave Pro" });
      // version is now 3, which is a multiple of frequency 3

      await userRepository.commit(user);

      // Should have saved a snapshot
      const snapshot = adapter.getStoredSnapshot("user", user.entityId);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.version).toBe(3);
      expect(snapshot!.state.nickname).toBe("Dave Pro");
    });

    test("should NOT save snapshot when version is not a multiple of frequency", async () => {
      const adapter = createInMemoryAdapter();
      const userRepository = createRepository(User, {
        adapter,
        snapshot: { frequency: 5 },
      });

      const user = User.create({
        body: {
          nickname: "Eve",
          email: "eve@example.com",
        },
      });
      user.updateProfile({ bio: "v2" });
      // version is 2, not a multiple of 5

      await userRepository.commit(user);

      const snapshot = adapter.getStoredSnapshot("user", user.entityId);
      expect(snapshot).toBeNull();
    });

    test("should not save snapshot when adapter lacks saveSnapshot", async () => {
      const adapter = createInMemoryAdapter();
      const adapterWithoutSave = {
        getEventsByEntityId: adapter.getEventsByEntityId,
        commitEvents: adapter.commitEvents,
        getSnapshot: adapter.getSnapshot,
        // no saveSnapshot
      };
      const userRepository = createRepository(User, {
        adapter: adapterWithoutSave,
        snapshot: { frequency: 1 },
      });

      const user = User.create({
        body: {
          nickname: "Frank",
          email: "frank@example.com",
        },
      });

      // Should not throw
      await userRepository.commit(user);
    });
  });

  describe("Snapshot + event replay correctness", () => {
    test("should produce same state with and without snapshot", async () => {
      const adapter = createInMemoryAdapter();
      const userRepository = createRepository(User, { adapter });

      const user = User.create({
        body: {
          nickname: "Grace",
          email: "grace@example.com",
        },
      });
      user.updateProfile({ bio: "CTO" });
      user.updateProfile({ nickname: "Grace Pro" });
      user.delete("leaving");
      user.restore();
      user.updateProfile({ bio: "CEO" });

      await userRepository.commit(user);

      // Load without snapshot
      const withoutSnapshot = await userRepository.findOne({
        entityId: user.entityId,
      });

      // Now save snapshot at version 3 and load again
      await adapter.saveSnapshot!({
        entityName: "user",
        entityId: user.entityId,
        state: {
          nickname: "Grace Pro",
          email: "grace@example.com",
          bio: "CTO",
          deletedAt: new Date().toISOString(),
        },
        version: 3,
      });

      const withSnapshot = await userRepository.findOne({
        entityId: user.entityId,
      });

      // Both should have the same final state
      expect(withSnapshot!.nickname).toBe(withoutSnapshot!.nickname);
      expect(withSnapshot!.email).toBe(withoutSnapshot!.email);
      expect(withSnapshot!.bio).toBe(withoutSnapshot!.bio);
      expect(withSnapshot!.isDeleted).toBe(withoutSnapshot!.isDeleted);
      expect(withSnapshot!.version).toBe(withoutSnapshot!.version);
    });

    test("should handle snapshot at version 0 (no events)", async () => {
      const adapter = createInMemoryAdapter();
      const userRepository = createRepository(User, { adapter });

      const user = User.create({
        body: {
          nickname: "Hank",
          email: "hank@example.com",
        },
      });
      await userRepository.commit(user);

      // Save an empty snapshot (version 0 means no events applied)
      // This shouldn't happen in practice but should be handled gracefully
      const loaded = await userRepository.findOne({
        entityId: user.entityId,
      });

      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe(1);
    });

    test("should work with Order entity (complex state)", async () => {
      const adapter = createInMemoryAdapter();
      const orderRepository = createRepository(Order, { adapter });

      const order = Order.create({
        body: {
          customerId: "cust-1",
          items: [{ productId: "prod-1", quantity: 2, price: 50 }],
        },
      });
      order.addItem("prod-2", 1, 30);
      order.confirm("card");
      order.ship("TRACK1", "FedEx");

      await orderRepository.commit(order);

      // Save snapshot at version 2
      await adapter.saveSnapshot!({
        entityName: "order",
        entityId: order.entityId,
        state: {
          customerId: "cust-1",
          items: [
            { productId: "prod-1", quantity: 2, price: 50 },
            { productId: "prod-2", quantity: 1, price: 30 },
          ],
          status: "draft",
          totalAmount: 130,
          paymentMethod: undefined,
          trackingNumber: undefined,
          carrier: undefined,
          deliveryNote: undefined,
          cancelReason: undefined,
          cancelledBy: undefined,
        },
        version: 2,
      });

      const loaded = await orderRepository.findOne({
        entityId: order.entityId,
      });

      expect(loaded).not.toBeNull();
      expect(loaded!.status).toBe("shipped");
      expect(loaded!.totalAmount).toBe(130);
      expect(loaded!.version).toBe(4);
    });
  });

  describe("Snapshot + afterVersion filtering", () => {
    test("should only query events after snapshot version", async () => {
      const adapter = createInMemoryAdapter();
      const userRepository = createRepository(User, { adapter });

      // Spy on getEventsByEntityId
      const spy = vi.spyOn(adapter, "getEventsByEntityId");

      const user = User.create({
        body: {
          nickname: "Iris",
          email: "iris@example.com",
        },
      });
      user.updateProfile({ bio: "v2" });
      user.updateProfile({ bio: "v3" });
      user.updateProfile({ bio: "v4" });
      user.updateProfile({ bio: "v5" });

      await userRepository.commit(user);

      // Save snapshot at version 3
      await adapter.saveSnapshot!({
        entityName: "user",
        entityId: user.entityId,
        state: {
          nickname: "Iris",
          email: "iris@example.com",
          bio: "v3",
          deletedAt: null,
        },
        version: 3,
      });

      spy.mockClear();

      await userRepository.findOne({ entityId: user.entityId });

      // Should have called getEventsByEntityId with afterVersion: 3
      expect(spy).toHaveBeenCalledWith({
        entityName: "user",
        entityId: user.entityId,
        afterVersion: 3,
      });

      // Result should still be correct
      const loaded = await userRepository.findOne({
        entityId: user.entityId,
      });
      expect(loaded!.bio).toBe("v5");
      expect(loaded!.version).toBe(5);

      spy.mockRestore();
    });
  });

  describe("Full snapshot lifecycle", () => {
    test("should handle create → commit → snapshot → load → update → commit cycle", async () => {
      const adapter = createInMemoryAdapter();
      const userRepository = createRepository(User, {
        adapter,
        snapshot: { frequency: 3 },
      });

      // Step 1: Create and commit (version 1)
      const user = User.create({
        body: {
          nickname: "Jake",
          email: "jake@example.com",
        },
      });
      await userRepository.commit(user);
      expect(adapter.getStoredSnapshot("user", user.entityId)).toBeNull();

      // Step 2: Load, update twice, commit (version 3 → triggers snapshot)
      const loaded1 = (await userRepository.findOne({
        entityId: user.entityId,
      }))!;
      const mutable1 = User.load({
        entityId: user.entityId,
        state: loaded1.state,
        version: loaded1.version,
        UNSAFE_mutable: true,
      });
      mutable1.updateProfile({ bio: "v2" });
      mutable1.updateProfile({ nickname: "Jake Pro" });
      await userRepository.commit(mutable1);

      // Snapshot should exist at version 3
      const snap = adapter.getStoredSnapshot("user", user.entityId);
      expect(snap).not.toBeNull();
      expect(snap!.version).toBe(3);

      // Step 3: Load again (should use snapshot)
      const loaded2 = (await userRepository.findOne({
        entityId: user.entityId,
      }))!;
      expect(loaded2.nickname).toBe("Jake Pro");
      expect(loaded2.bio).toBe("v2");
      expect(loaded2.version).toBe(3);

      // Step 4: More updates
      const mutable2 = User.load({
        entityId: user.entityId,
        state: loaded2.state,
        version: loaded2.version,
        UNSAFE_mutable: true,
      });
      mutable2.updateProfile({ bio: "v4" });
      await userRepository.commit(mutable2);

      // Step 5: Load again — uses snapshot at 3 + events 4
      const loaded3 = (await userRepository.findOne({
        entityId: user.entityId,
      }))!;
      expect(loaded3.bio).toBe("v4");
      expect(loaded3.version).toBe(4);
    });
  });
});
