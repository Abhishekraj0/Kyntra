import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { generateId, sanitizePayload } from "@kyntra/shared";

const UiEventSchema = z.object({
  projectId: z.string(),
  sessionId: z.string(),
  userId: z.string().optional(),
  type: z.enum(["click", "navigation", "api_call", "error", "performance", "form_submit", "page_load", "custom"]),
  element: z.string().optional(),
  url: z.string(),
  referrer: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  timestamp: z.string(),
  durationMs: z.number().optional(),
});

const EventBatchSchema = z.object({
  projectId: z.string(),
  apiKey: z.string(),
  events: z.array(UiEventSchema),
  sentAt: z.string(),
  sdkVersion: z.string().default("unknown"),
});

export async function eventsRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/events",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const apiKey = req.headers["x-kyntra-key"];
      if (!apiKey) {
        return reply.status(401).send({ error: "Missing X-Kyntra-Key header" });
      }

      const project = await prisma.project.findUnique({
        where: { apiKey: String(apiKey) },
        select: { id: true },
      });

      if (!project) {
        return reply.status(401).send({ error: "Invalid API key" });
      }

      const parsed = EventBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }

      const { events } = parsed.data;
      const batchId = generateId("batch");

      const eventData = events.map((event) => ({
        id: generateId(),
        projectId: project.id,
        sessionId: event.sessionId,
        userId: event.userId ?? null,
        type: event.type,
        element: event.element ?? null,
        url: event.url.slice(0, 2048),
        referrer: event.referrer ?? null,
        metadata: sanitizePayload(event.metadata) as object,
        timestamp: new Date(event.timestamp),
        durationMs: event.durationMs ?? null,
      }));

      await prisma.uiEvent.createMany({ data: eventData, skipDuplicates: false });

      return reply.status(202).send({ accepted: events.length, batchId });
    }
  );
}
