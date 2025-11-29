import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { BaseEventType, SchemaInput, ValueOf } from "./types";

/**
 * Creates a Standard Schema provider for Ventyd.
 *
 * This is a generic adapter that allows any Standard Schema-compliant validation library
 * to work with Ventyd's event sourcing system.
 *
 * @typeParam $$EntityName - The entity name type (inferred from `defineSchema`)
 * @typeParam $$EventDefinition - Object mapping event names to Standard Schema instances
 * @typeParam $$StateDefinition - Standard Schema instance for entity state
 *
 * @param args - Schema definition
 * @param args.event - Map of event names to Standard Schema instances defining event schemas
 * @param args.state - Standard Schema instance defining the entity state structure
 *
 * @returns A schema provider function compatible with Ventyd's `SchemaInput` interface
 *
 * @remarks
 * This provider implements the Standard Schema specification (https://standardschema.dev),
 * allowing any compliant validation library (Valibot, Zod, ArkType, etc.) to integrate with Ventyd.
 *
 * Note: Async validation is not supported. The schema must return a synchronous result.
 *
 * @example
 * Using with a Standard Schema-compliant library:
 * ```typescript
 * import { defineSchema } from 'ventyd';
 * import { standard } from 'ventyd/standard';
 * import * as v from 'valibot'; // or any Standard Schema library
 *
 * const userSchema = defineSchema("user", {
 *   schema: standard({
 *     event: {
 *       "user:created": v.object({
 *         eventId: v.string(),
 *         eventName: v.literal("user:created"),
 *         eventCreatedAt: v.string(),
 *         entityName: v.string(),
 *         entityId: v.string(),
 *         body: v.object({
 *           email: v.pipe(v.string(), v.email())
 *         })
 *       })
 *     },
 *     state: v.object({
 *       email: v.string()
 *     })
 *   }),
 *   initialEventName: "user:created"
 * });
 * ```
 *
 * @see {@link https://standardschema.dev} for Standard Schema specification
 * @see {@link valibot} for a higher-level Valibot integration that handles event namespacing automatically
 */
export function standard<
  $$EntityName extends string,
  $$EventDefinition extends {
    [eventName: string]: StandardSchemaV1<unknown, BaseEventType>;
  },
  $$StateDefinition extends StandardSchemaV1,
>(args: {
  event: $$EventDefinition;
  state: $$StateDefinition;
}): SchemaInput<
  $$EntityName,
  StandardSchemaV1.InferOutput<ValueOf<$$EventDefinition>>,
  StandardSchemaV1.InferOutput<$$StateDefinition>
> {
  type $$EventType = StandardSchemaV1.InferOutput<ValueOf<$$EventDefinition>>;
  return (context) => {
    return {
      parseEvent(input) {
        for (const eventSchema of Object.values(args.event)) {
          try {
            return standardValidate(eventSchema, input);
          } catch {}
        }

        throw new Error("Validation failed");
      },
      parseEventByName<K extends $$EventType["eventName"]>(
        eventName: K,
        input: unknown,
      ) {
        const eventSchema = args.event[eventName];

        if (!eventSchema) {
          const availableEvents = Object.keys(args.event).join(", ");
          throw new Error(
            `Event name "${eventName}" not found. Available events: ${availableEvents}`,
          );
        }

        return standardValidate(eventSchema, input, eventName) as Extract<
          StandardSchemaV1.InferOutput<$$EventDefinition[K]>,
          { eventName: K }
        >;
      },
      parseState(input) {
        return standardValidate(args.state, input);
      },
    };
  };
}

/**
 * Validates input against a Standard Schema.
 *
 * @param schema - The Standard Schema to validate against
 * @param input - The input value to validate
 * @param eventName - Optional event name for better error messages
 * @returns The validated and typed output
 * @throws {Error} If validation fails or if the schema returns a Promise
 *
 * @internal
 */
function standardValidate<T extends StandardSchemaV1>(
  schema: T,
  input: unknown,
  eventName?: string,
): StandardSchemaV1.InferOutput<T> {
  const result = schema["~standard"].validate(input);

  if (result instanceof Promise) {
    throw new Error("Promise validation result is not supported");
  }
  if (result.issues) {
    const formattedError = formatStandardSchemaIssues(result.issues, eventName);
    throw new Error(formattedError);
  }

  return result.value as StandardSchemaV1.InferOutput<T>;
}

/**
 * Formats Standard Schema validation issues into a readable error message.
 *
 * @param issues - Array of validation issues from Standard Schema
 * @param eventName - Optional event name to include in the error message
 * @returns Formatted error message string
 *
 * @internal
 */
function formatStandardSchemaIssues(
  issues: readonly StandardSchemaV1.Issue[],
  eventName?: string,
): string {
  const header = eventName
    ? `Validation failed: "${eventName}"`
    : "Validation failed";

  const errors = issues
    .map((issue) => {
      const pathStr =
        issue.path && issue.path.length > 0
          ? issue.path
              .map((segment) =>
                typeof segment === "object" ? segment.key : segment,
              )
              .join(".")
          : "(root)";

      return `  - ${pathStr}: ${issue.message}`;
    })
    .join("\n");

  return errors ? `${header}\n${errors}` : header;
}
