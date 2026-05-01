import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { generateId, slugify } from "@kyntra/shared";

const CreateProjectSchema = z.object({
  name: z.string().min(2).max(100),
  githubRepoUrl: z.string().url().optional(),
});

export async function projectsRoutes(app: FastifyInstance, { prisma }: { prisma: PrismaClient }): Promise<void> {
  // List all projects
  app.get("/v1/projects", async (_req: FastifyRequest, reply: FastifyReply) => {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, slug: true, githubRepoUrl: true, createdAt: true,
        _count: { select: { traces: true, codeReviews: true } },
      },
    });
    return reply.send({ data: projects });
  });

  // Get single project
  app.get("/v1/projects/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { traces: true, endpoints: true, codeReviews: true } } },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    return reply.send({ data: project });
  });

  // Create project
  app.post("/v1/projects", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const { name, githubRepoUrl } = parsed.data;
    const slug = slugify(name);
    const apiKey = `kyn_live_${generateId()}`;

    const project = await prisma.project.create({
      data: {
        id: generateId(),
        name,
        slug: `${slug}-${generateId().slice(0, 6)}`,
        apiKey,
        githubRepoUrl,
        settings: {
          enableAiReviews: true,
          enableTestGeneration: true,
          enableAnomalyDetection: true,
          dataRetentionDays: 30,
          alertThresholds: { errorRatePercent: 5, latencyP99Ms: 2000, healthScoreMin: 70 },
          maskedFields: ["password", "token", "secret"],
        },
      },
    });

    return reply.status(201).send({ data: project });
  });

  // Delete project
  app.delete("/v1/projects/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.project.delete({ where: { id: req.params.id } });
    return reply.status(204).send();
  });
}
