/** biome-ignore-all lint/style/noNonNullAssertion: for testing */
/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import * as v from "valibot";
import { describe, expect, test } from "vitest";
import type { BaseEventType } from "../src";
import {
  createRepository,
  defineReducer,
  defineSchema,
  Entity,
  mutation,
} from "../src";
import { valibot } from "../src/valibot";
import { createInMemoryAdapter } from "./adapters/InMemoryAdapter";

describe("Version rollback on validation failure", () => {
  const schema = defineSchema("counter", {
    schema: valibot({
      event: {
        created: v.object({ value: v.number() }),
        incremented: v.object({ amount: v.pipe(v.number(), v.minValue(1)) }),
      },
      state: v.object({ value: v.number() }),
    }),
    initialEventName: "counter:created",
  });

  const reducer = defineReducer(schema, (prevState, event) => {
    if (event.eventName === "counter:created") {
      return { value: event.body.value };
    }
    if (event.eventName === "counter:incremented") {
      return { value: prevState.value + event.body.amount };
    }
    return prevState;
  });

  class Counter extends Entity(schema, reducer) {
    increment = mutation(this, (dispatch, amount: number) => {
      dispatch("counter:incremented", { amount });
    });
  }

  test("should not corrupt version when dispatch fails validation", () => {
    const counter = Counter.create({ body: { value: 0 } });
    expect(counter.version).toBe(1);

    // Successful dispatch
    counter.increment(5);
    expect(counter.version).toBe(2);

    // Failed dispatch — amount must be >= 1
    expect(() => counter.increment(-1)).toThrow();

    // Version should still be 2, NOT 3
    expect(counter.version).toBe(2);
    expect(counter[" $$queuedEvents"].length).toBe(2);

    // Next successful dispatch should get version 3
    counter.increment(10);
    expect(counter.version).toBe(3);

    const events = counter[" $$queuedEvents"] as BaseEventType[];
    expect(events[0]!.version).toBe(1);
    expect(events[1]!.version).toBe(2);
    expect(events[2]!.version).toBe(3);
  });

  test("should calculate correct expectedVersion after failed dispatches", async () => {
    const adapter = createInMemoryAdapter();
    const repository = createRepository(Counter, { adapter });

    const counter = Counter.create({ body: { value: 0 } });
    counter.increment(5);

    // Fail a dispatch
    expect(() => counter.increment(-1)).toThrow();

    // Succeed another dispatch
    counter.increment(10);

    // version=3, queuedEvents=3 → expectedVersion should be 0
    await repository.commit(counter);

    const loaded = await repository.findOne({ entityId: counter.entityId });
    expect(loaded!.state.value).toBe(15); // 0 + 5 + 10
    expect(loaded!.version).toBe(3);
  });
});
