import type {
  Adapter,
  BaseEventType,
  InferEntityNameFromSchema,
  InferEventFromSchema,
  InferStateFromSchema,
} from "../types";

type BaseEventRow = Omit<
  BaseEventType,
  "eventCreatedAt" | "body" | "version"
> & {
  eventCreatedAt: Date;
  body: unknown;
  version?: number;
};

type BaseSnapshotRow = {
  entityId: string;
  entityName: string;
  state: unknown;
  version: number;
};

export type VentydAdapterOptions<
  $$Schema,
  $$PrismaEventRow extends BaseEventRow,
  $$PrismaEventRowInput,
  $$PrismaSnapshotRow extends BaseSnapshotRow,
  $$PrismaSnapshotRowInput,
  $$PrismaViewRowInput,
> = {
  prisma: {
    $transaction: (commands: unknown[]) => Promise<unknown[]>;
  };
  /**
   * Save a snapshot every N events. When the latest event version is a
   * multiple of this value, a snapshot is written inside the same transaction
   * as the events and view update.
   */
  snapshotEvery?: number;
  tables: {
    event: {
      findMany(args?: {
        where: {
          entityName: string;
          entityId: string;
          version?: { gt: number };
        };
      }): Promise<$$PrismaEventRow[]>;
      createMany(args?: { data: $$PrismaEventRowInput[] }): Promise<unknown>;
    };
    snapshot: {
      findFirst(args: {
        where: { entityId: string; entityName: string };
      }): Promise<$$PrismaSnapshotRow | null>;
      upsert(args: {
        where: { entityId: string };
        update: Partial<$$PrismaSnapshotRowInput>;
        create: $$PrismaSnapshotRowInput;
      }): Promise<unknown>;
    };
    view: {
      upsert(args: {
        where: { entityId: string };
        update: Partial<$$PrismaViewRowInput>;
        create: $$PrismaViewRowInput;
      }): Promise<unknown>;
    };
  };
  entityToViewRow(args: {
    entityId: string;
    entityName: InferEntityNameFromSchema<$$Schema>;
    state: InferStateFromSchema<$$Schema>;
    version: number;
  }): $$PrismaViewRowInput;
};

export function prismaAdapter<
  $$Schema,
  $$PrismaEventRow extends BaseEventRow,
  $$PrismaEventRowInput,
  $$PrismaSnapshotRow extends BaseSnapshotRow,
  $$PrismaSnapshotRowInput,
  $$PrismaViewRowInput,
>(
  options: VentydAdapterOptions<
    $$Schema,
    $$PrismaEventRow,
    $$PrismaEventRowInput,
    $$PrismaSnapshotRow,
    $$PrismaSnapshotRowInput,
    $$PrismaViewRowInput
  >,
): Adapter<$$Schema> {
  function eventToRow(_event: InferEventFromSchema<$$Schema>) {
    const event = _event as BaseEventType;

    const row = {
      eventId: event.eventId,
      eventName: event.eventName,
      entityId: event.entityId,
      entityName: event.entityName,
      eventCreatedAt: new Date(event.eventCreatedAt),
      body: event.body,
      version: event.version,
    } as $$PrismaEventRowInput;

    return row;
  }

  function rowToEvent(row: $$PrismaEventRow) {
    const event = {
      eventId: row.eventId,
      eventName: row.eventName,
      entityId: row.entityId,
      entityName: row.entityName,
      eventCreatedAt: row.eventCreatedAt.toISOString(),
      body: row.body,
      version: row.version,
    } as InferEventFromSchema<$$Schema>;

    return event;
  }

  return {
    async getEventsByEntityId({ entityName, entityId, afterVersion }) {
      const rows = await options.tables.event.findMany({
        where: {
          entityName,
          entityId,
          ...(afterVersion != null
            ? { version: { gt: afterVersion } }
            : undefined),
        },
      });

      return rows.map(rowToEvent);
    },

    async getSnapshot({ entityName, entityId }) {
      const row = await options.tables.snapshot.findFirst({
        where: { entityId, entityName },
      });

      if (!row) return null;

      return {
        state: row.state as InferStateFromSchema<$$Schema>,
        version: row.version,
      };
    },

    async commitEvents({ events, entityId, entityName, state }) {
      const lastEvent = events[events.length - 1] as BaseEventType | undefined;
      const lastVersion = lastEvent?.version ?? 0;

      const viewRow = options.entityToViewRow({
        entityId,
        entityName,
        state,
        version: lastVersion,
      });

      const transactionCommands: unknown[] = [
        options.tables.event.createMany({
          data: events.map(eventToRow),
        }),
        options.tables.view.upsert({
          where: { entityId },
          update: viewRow,
          create: viewRow,
        }),
      ];

      const shouldSnapshot =
        options.snapshotEvery != null &&
        lastVersion > 0 &&
        lastVersion % options.snapshotEvery === 0;

      if (shouldSnapshot) {
        const snapshotRow = {
          entityId,
          entityName,
          state,
          version: lastVersion,
        } as $$PrismaSnapshotRowInput;
        transactionCommands.push(
          options.tables.snapshot.upsert({
            where: { entityId },
            update: snapshotRow,
            create: snapshotRow,
          }),
        );
      }

      await options.prisma.$transaction(transactionCommands);
    },
  };
}
