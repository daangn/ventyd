import type {
  Adapter,
  BaseEventType,
  InferEventFromSchema,
  InferStateFromSchema,
} from "../types";

type BaseEventTypeRow = Omit<BaseEventType, "eventCreatedAt" | "body"> & {
  eventCreatedAt: Date;
  body: unknown;
};

export type VentydAdapterOptions<
  $$Schema,
  $$PrismaEventRow extends BaseEventTypeRow,
  $$PrismaEventRowInput,
  $$PrismaSnapshotRowInput,
> = {
  prisma: {
    $transaction: (commands: unknown[]) => Promise<unknown[]>;
  };
  tables: {
    event: {
      findMany(args?: {
        where: { entityName: string; entityId: string };
      }): Promise<$$PrismaEventRow[]>;
      createMany(args?: { data: $$PrismaEventRowInput[] }): Promise<unknown>;
    };
    snapshot: {
      upsert(args: {
        where: { id?: string };
        update: $$PrismaSnapshotRowInput;
        create: $$PrismaSnapshotRowInput;
      }): Promise<unknown>;
    };
  };
  entityToRow(args: {
    entityId: string;
    state: InferStateFromSchema<$$Schema>;
  }): $$PrismaSnapshotRowInput;
};

export default function prismaAdapter<
  $$Schema,
  $$PrismaEventRow extends BaseEventTypeRow,
  $$PrismaEventRowInput,
  $$PrismaSnapshotRowInput,
>(
  options: VentydAdapterOptions<
    $$Schema,
    $$PrismaEventRow,
    $$PrismaEventRowInput,
    $$PrismaSnapshotRowInput
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
    } as InferEventFromSchema<$$Schema>;

    return event;
  }

  return {
    async getEventsByEntityId({ entityName, entityId }) {
      const rows = await options.tables.event.findMany({
        where: {
          entityName,
          entityId,
        },
      });

      return rows.map(rowToEvent);
    },
    async commitEvents({ events, entityId, state }) {
      const snapshotRow = options.entityToRow({
        entityId,
        state,
      });

      await options.prisma.$transaction([
        options.tables.event.createMany({
          data: events.map(eventToRow),
        }),
        options.tables.snapshot.upsert({
          where: { id: entityId },
          update: snapshotRow,
          create: snapshotRow,
        }),
      ]);
    },
  };
}
