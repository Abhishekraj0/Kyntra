import { Worker, Queue, type Job } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { analyzeApiHealth } from "../analyzers/api-health.js";
import { detectAnomalies } from "../analyzers/anomaly.js";
import { analyzeRootCause } from "../analyzers/root-cause.js";
import { generateTests } from "../analyzers/test-generator.js";
import { performCodeReview } from "../analyzers/code-review.js";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

export const analysisQueue = new Queue("kyntra:analysis", {
  // @ts-ignore
  connection: new IORedis(REDIS_URL, { maxRetriesPerRequest: null }),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export type AnalysisJobData =
  | { type: "api_health"; projectId: string; endpointId: string; analysisId: string; windowMinutes?: number }
  | { type: "anomaly_detection"; projectId: string; analysisId: string; endpointPath?: string; windowMinutes?: number }
  | { type: "root_cause"; projectId: string; analysisId: string; startTime: string; endTime: string; affectedPaths?: string[] }
  | { type: "test_generation"; projectId: string; endpointId: string; analysisId: string; framework?: "jest" | "vitest" }
  | { type: "code_review"; projectId: string; reviewId: string; analysisId: string; diff: string; prTitle: string; prDescription?: string; language?: string; framework?: string };

export function createWorker(prisma: PrismaClient): Worker {
  // @ts-ignore
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  const worker = new Worker<AnalysisJobData>(
    "kyntra:analysis",
    async (job: Job<AnalysisJobData>) => {
      const data = job.data;
      console.log(`[Worker] Processing job ${job.id}: ${data.type}`);

      await prisma.analysisResult.update({
        where: { id: data.analysisId },
        data: { status: "running" },
      });

      try {
        let output: unknown;
        let summary = "";

        switch (data.type) {
          case "api_health": {
            output = await analyzeApiHealth(prisma, data.projectId, data.endpointId, data.windowMinutes ?? 60);
            const h = output as { healthScore: number; healthStatus: string };
            summary = `Health score: ${h.healthScore}/100 (${h.healthStatus})`;
            break;
          }
          case "anomaly_detection": {
            output = await detectAnomalies(prisma, data.projectId, data.endpointPath, data.windowMinutes ?? 120);
            const a = output as { anomalies: unknown[] };
            summary = `Detected ${a.anomalies.length} anomalies`;
            break;
          }
          case "root_cause": {
            output = await analyzeRootCause(prisma, data.projectId, {
              startTime: data.startTime,
              endTime: data.endTime,
              ...(data.affectedPaths ? { affectedPaths: data.affectedPaths } : {}),
            });
            const rc = output as { rootCause: string };
            summary = rc.rootCause;
            break;
          }
          case "test_generation": {
            output = await generateTests(prisma, data.projectId, data.endpointId, data.framework ?? "vitest");
            const tg = output as { testFile: { testCount: number } };
            summary = `Generated ${tg.testFile.testCount} test cases`;
            break;
          }
          case "code_review": {
            output = await performCodeReview(
              prisma, data.reviewId, data.diff, data.prTitle,
              data.prDescription, data.language ?? "typescript", data.framework
            );
            const cr = output as { riskScore: number; comments: unknown[] };
            summary = `Risk score: ${cr.riskScore}/100, ${cr.comments.length} comments`;
            break;
          }
        }

        await prisma.analysisResult.update({
          where: { id: data.analysisId },
          data: { status: "complete", output: output as object, summary, completedAt: new Date() },
        });

        console.log(`[Worker] Completed job ${job.id}: ${summary}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await prisma.analysisResult.update({
          where: { id: data.analysisId },
          data: { status: "failed", errorMessage: message, completedAt: new Date() },
        });
        throw err; // Let BullMQ handle retry
      }
    },
    {
      connection,
      concurrency: 3,
      limiter: { max: 10, duration: 60000 }, // 10 AI calls/minute max
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed after retries:`, err.message);
  });

  return worker;
}
