import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { generateId } from "@kyntra/shared";
import { analysisQueue } from "../workers/analysis-worker.js";
import type { AnalysisJobData } from "../workers/analysis-worker.js";

const AnalyzeRequestSchema = z.object({
  type: z.enum(["api_health", "anomaly_detection", "root_cause", "test_generation", "code_review"]),
  projectId: z.string(),
  options: z.record(z.unknown()).default({}),
});

export async function analyzeRoutes(app: FastifyInstance, { prisma }: { prisma: PrismaClient }): Promise<void> {
  // Trigger analysis
  app.post("/analyze", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = AnalyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { type, projectId, options } = parsed.data;
    const analysisId = generateId("analysis");

    // Create pending record
    await prisma.analysisResult.create({
      data: { id: analysisId, projectId, type, status: "pending", input: options, summary: "" },
    });

    // Build job payload
    let jobData: AnalysisJobData;

    switch (type) {
      case "api_health":
        jobData = {
          type: "api_health",
          projectId,
          endpointId: options["endpointId"] as string,
          analysisId,
          ...(options["windowMinutes"] !== undefined ? { windowMinutes: options["windowMinutes"] as number } : {}),
        };
        break;
      case "anomaly_detection":
        jobData = {
          type: "anomaly_detection",
          projectId,
          analysisId,
          ...(options["endpointPath"] !== undefined ? { endpointPath: options["endpointPath"] as string } : {}),
          ...(options["windowMinutes"] !== undefined ? { windowMinutes: options["windowMinutes"] as number } : {}),
        };
        break;
      case "root_cause":
        jobData = {
          type: "root_cause",
          projectId,
          analysisId,
          startTime: options["startTime"] as string,
          endTime: options["endTime"] as string,
          ...(options["affectedPaths"] !== undefined ? { affectedPaths: options["affectedPaths"] as string[] } : {}),
        };
        break;
      case "test_generation":
        jobData = {
          type: "test_generation",
          projectId,
          endpointId: options["endpointId"] as string,
          analysisId,
          ...(options["framework"] !== undefined ? { framework: options["framework"] as "jest" | "vitest" } : {}),
        };
        break;
      case "code_review":
        jobData = {
          type: "code_review",
          projectId,
          reviewId: options["reviewId"] as string,
          analysisId,
          diff: options["diff"] as string,
          prTitle: options["prTitle"] as string,
          ...(options["prDescription"] !== undefined ? { prDescription: options["prDescription"] as string } : {}),
          ...(options["language"] !== undefined ? { language: options["language"] as string } : {}),
          ...(options["framework"] !== undefined ? { framework: options["framework"] as string } : {}),
        };
        break;
    }

    await analysisQueue.add(type, jobData, { priority: type === "code_review" ? 1 : 5 });

    return reply.status(202).send({ analysisId, status: "pending" });
  });

  // Poll analysis status
  app.get("/analyze/:analysisId", async (
    req: FastifyRequest<{ Params: { analysisId: string } }>,
    reply: FastifyReply
  ) => {
    const analysis = await prisma.analysisResult.findUnique({
      where: { id: req.params.analysisId },
    });
    if (!analysis) return reply.status(404).send({ error: "Analysis not found" });
    return reply.send(analysis);
  });

  // Get recent analyses for a project
  app.get("/analyze", async (
    req: FastifyRequest<{ Querystring: { projectId: string; type?: string; limit?: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId, type, limit = "20" } = req.query;
    if (!projectId) return reply.status(400).send({ error: "projectId required" });

    const results = await prisma.analysisResult.findMany({
      where: { projectId, ...(type ? { type } : {}) },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(limit), 100),
    });

    return reply.send({ data: results });
  });

  // Queue health
  app.get("/queue/stats", async (_req: FastifyRequest, reply: FastifyReply) => {
    const [waiting, active, completed, failed] = await Promise.all([
      analysisQueue.getWaitingCount(),
      analysisQueue.getActiveCount(),
      analysisQueue.getCompletedCount(),
      analysisQueue.getFailedCount(),
    ]);
    return reply.send({ waiting, active, completed, failed });
  });
}
