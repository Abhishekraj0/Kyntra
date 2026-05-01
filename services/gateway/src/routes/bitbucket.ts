/**
 * Bitbucket Cloud webhook handler.
 * Receives pullrequest:created / pullrequest:updated events,
 * triggers AI code review, and posts results back to the PR.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import {
  verifyBitbucketWebhook,
  getBitbucketPrDiff,
  postBitbucketPrComment,
  getBitbucketAccessToken,
  extractBitbucketPrInfo,
  type BitbucketPrEvent,
} from "../services/bitbucket.js";

const ANALYZER_URL = process.env["ANALYZER_URL"] ?? "http://localhost:3002";

function formatBitbucketReviewComment(review: {
  summary: string;
  riskScore: number;
  comments?: Array<{ severity: string; message: string; suggestion?: string; file?: string }>;
}): string {
  const riskLabel = review.riskScore >= 70 ? "HIGH RISK \uD83D\uDD34" : review.riskScore >= 40 ? "MEDIUM RISK \uD83D\uDFE1" : "LOW RISK \uD83D\uDFE2";

  const lines: string[] = [
    `## \uD83E\uDD16 Kyntra AI Code Review \u2014 ${riskLabel}`,
    ``,
    `**Risk Score:** ${review.riskScore}/100`,
    ``,
    review.summary,
  ];

  const issues = (review.comments ?? []).filter((c) => c.severity === "critical" || c.severity === "high");
  if (issues.length > 0) {
    lines.push(``, `**Issues:**`);
    for (const issue of issues.slice(0, 10)) {
      lines.push(`- [${issue.severity.toUpperCase()}] ${issue.file ? `\`${issue.file}\`: ` : ""}${issue.message}`);
      if (issue.suggestion) lines.push(`  > ${issue.suggestion}`);
    }
  }

  lines.push(``, `---`, `*[Kyntra](https://github.com/kyntra/kyntra) \u2014 AI-native engineering intelligence*`);
  return lines.join("\n");
}

export async function bitbucketRoutes(
  app: FastifyInstance,
  { prisma }: { prisma: PrismaClient }
): Promise<void> {
  /**
   * POST /v1/bitbucket/webhook
   * Receives Bitbucket webhook events.
   */
  app.post("/v1/bitbucket/webhook", async (req: FastifyRequest, reply: FastifyReply) => {
    const eventType = req.headers["x-event-key"] as string | undefined;
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers["x-hub-signature"] as string | undefined;
    const body = req.body as BitbucketPrEvent;

    // Only handle PR events
    if (!eventType?.startsWith("pullrequest:")) {
      return reply.status(200).send({ ok: true, skipped: true });
    }

    // Skip merged/declined PRs
    if (eventType === "pullrequest:fulfilled" || eventType === "pullrequest:rejected") {
      return reply.status(200).send({ ok: true, skipped: true });
    }

    try {
      const info = extractBitbucketPrInfo(body);

      // Find the project
      const project = await prisma.project.findFirst({
        where: {
          settings: {
            path: ["bitbucketRepoFullName"],
            equals: info.repoFullName,
          },
        },
      });

      if (!project) {
        return reply.status(200).send({ ok: true, skipped: true, reason: "project_not_found" });
      }

      const settings = project.settings as Record<string, unknown>;
      const webhookSecret = (settings["bitbucketWebhookSecret"] as string) ?? "";

      // Verify webhook signature
      if (webhookSecret && !verifyBitbucketWebhook(rawBody, signature, webhookSecret)) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      reply.status(200).send({ ok: true, message: "Processing" });

      void processBitbucketPr(app, prisma, project.id, project.settings as Record<string, unknown>, info).catch((err) => {
        app.log.error({ err }, "[Bitbucket] Failed to process PR");
      });
    } catch (err) {
      app.log.error({ err }, "[Bitbucket Webhook] Error");
      return reply.status(200).send({ ok: true });
    }
  });
}

async function processBitbucketPr(
  app: FastifyInstance,
  prisma: PrismaClient,
  projectId: string,
  settings: Record<string, unknown>,
  info: ReturnType<typeof extractBitbucketPrInfo>
): Promise<void> {
  const clientId = settings["bitbucketClientId"] as string;
  const clientSecret = settings["bitbucketClientSecret"] as string;

  if (!clientId || !clientSecret) {
    app.log.warn("[Bitbucket] No OAuth credentials configured");
    return;
  }

  const accessToken = await getBitbucketAccessToken(clientId, clientSecret);
  const diff = await getBitbucketPrDiff(info.workspace, info.repoSlug, info.pullRequestId, accessToken);

  const review = await prisma.codeReview.upsert({
    where: { projectId_prNumber: { projectId, prNumber: info.pullRequestId } },
    create: {
      id: `cr_${Date.now()}`,
      projectId,
      prNumber: info.pullRequestId,
      prUrl: info.prUrl,
      prTitle: info.prTitle,
      prAuthor: info.prAuthor,
      baseBranch: info.targetBranch,
      headBranch: info.sourceBranch,
      diffSummary: diff.slice(0, 500),
      status: "pending",
    },
    update: { status: "pending", diffSummary: diff.slice(0, 500) },
  });

  const analysisRes = await fetch(`${ANALYZER_URL}/v1/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, reviewId: review.id, diff, language: "unknown", provider: "bitbucket" }),
  });

  if (!analysisRes.ok) return;

  const { data: analysisData } = await analysisRes.json() as { data: { analysisId: string } };

  let result: { output?: unknown } | null = null;
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const pollRes = await fetch(`${ANALYZER_URL}/v1/analyze/${analysisData.analysisId}`);
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json() as { data: { status: string; output?: unknown } };
    if (pollData.data.status === "completed") { result = pollData.data; break; }
    if (pollData.data.status === "failed") break;
  }

  if (!result?.output) return;

  const output = result.output as { summary: string; riskScore: number; comments?: Array<{ severity: string; message: string; suggestion?: string; file?: string }> };
  const comment = formatBitbucketReviewComment(output);
  await postBitbucketPrComment(info.workspace, info.repoSlug, info.pullRequestId, accessToken, comment);

  await prisma.codeReview.update({
    where: { id: review.id },
    data: { riskScore: output.riskScore, status: "completed", analysisId: analysisData.analysisId },
  });

  app.log.info(`[Bitbucket] PR #${info.pullRequestId} review complete \u2014 risk ${output.riskScore}/100`);
}
