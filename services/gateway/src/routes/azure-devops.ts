/**
 * Azure DevOps webhook handler.
 * Receives service hook events for pull_request.created / pull_request.updated,
 * triggers AI code review via the analyzer, and posts results back to the PR.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import {
  verifyAdoWebhook,
  getAdoPullRequestDiff,
  postAdoPrComment,
  updateAdoPrStatus,
  extractAdoRepoInfo,
  type AdoPullRequestEvent,
} from "../services/azure-devops.js";

const ANALYZER_URL = process.env["ANALYZER_URL"] ?? "http://localhost:3002";

function formatAdoReviewComment(review: {
  summary: string;
  riskScore: number;
  comments?: Array<{ type: string; severity: string; message: string; suggestion?: string; file?: string }>;
}): string {
  const riskEmoji = review.riskScore >= 70 ? "\uD83D\uDD34" : review.riskScore >= 40 ? "\uD83D\uDFE1" : "\uD83D\uDFE2";
  const riskLabel = review.riskScore >= 70 ? "HIGH" : review.riskScore >= 40 ? "MEDIUM" : "LOW";

  const lines: string[] = [
    `## \uD83E\uDD16 Kyntra AI Code Review`,
    ``,
    `**Risk Score:** ${riskEmoji} ${review.riskScore}/100 (${riskLabel})`,
    ``,
    `### Summary`,
    review.summary,
  ];

  const critical = (review.comments ?? []).filter((c) => c.severity === "critical" || c.severity === "high");
  if (critical.length > 0) {
    lines.push(``, `### Issues Found`);
    for (const c of critical.slice(0, 10)) {
      lines.push(`- **[${c.severity.toUpperCase()}]** ${c.file ? `\`${c.file}\`: ` : ""}${c.message}`);
      if (c.suggestion) lines.push(`  > \uD83D\uDCA1 ${c.suggestion}`);
    }
  }

  lines.push(``, `---`, `*Powered by [Kyntra](https://github.com/kyntra/kyntra) \u2014 AI-native engineering intelligence*`);
  return lines.join("\n");
}

export async function azureDevopsRoutes(
  app: FastifyInstance,
  { prisma }: { prisma: PrismaClient }
): Promise<void> {
  /**
   * POST /v1/azure-devops/webhook
   * Receives Azure DevOps service hook events.
   */
  app.post(
    "/v1/azure-devops/webhook",
    { config: { rawBody: true } as any },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as AdoPullRequestEvent;
      const authHeader = req.headers["authorization"] as string | undefined;

      // Only handle PR events
      if (!body.eventType?.startsWith("git.pullrequest")) {
        return reply.status(200).send({ ok: true, skipped: true });
      }

      try {
        const info = extractAdoRepoInfo(body);

        // Find the project by repo URL
        const project = await prisma.project.findFirst({
          where: {
            settings: {
              path: ["azureDevopsRepoUrl"],
              equals: info.repoUrl,
            },
          },
        });

        if (!project) {
          app.log.warn(`[ADO Webhook] No project found for repo ${info.repoUrl}`);
          return reply.status(200).send({ ok: true, skipped: true, reason: "project_not_found" });
        }

        const settings = project.settings as Record<string, unknown>;
        const webhookSecret = (settings["azureDevopsWebhookSecret"] as string) ?? "";
        const pat = (settings["azureDevopsToken"] as string) ?? "";

        // Verify webhook secret if configured
        if (webhookSecret && !verifyAdoWebhook(authHeader, webhookSecret)) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        reply.status(200).send({ ok: true, message: "Processing" });

        // Background: fetch diff, trigger analysis, post comment
        void processAdoPr(app, prisma, project.id, info, pat).catch((err) => {
          app.log.error({ err }, "[ADO] Failed to process PR");
        });
      } catch (err) {
        app.log.error({ err }, "[ADO Webhook] Error");
        return reply.status(200).send({ ok: true });
      }
    }
  );
}

async function processAdoPr(
  app: FastifyInstance,
  prisma: PrismaClient,
  projectId: string,
  info: ReturnType<typeof extractAdoRepoInfo>,
  pat: string
): Promise<void> {
  if (!pat) {
    app.log.warn("[ADO] No PAT configured for project");
    return;
  }

  // Fetch the diff
  const diff = await getAdoPullRequestDiff(
    info.organizationUrl,
    info.projectId,
    info.repositoryId,
    info.pullRequestId,
    pat
  );

  // Upsert code review record
  const review = await prisma.codeReview.upsert({
    where: { projectId_prNumber: { projectId, prNumber: info.pullRequestId } },
    create: {
      id: `cr_${Date.now()}`,
      projectId,
      prNumber: info.pullRequestId,
      prUrl: `${info.organizationUrl}/${info.projectName}/_git/${info.repositoryName}/pullrequest/${info.pullRequestId}`,
      prTitle: info.prTitle,
      prAuthor: info.prAuthor,
      baseBranch: info.targetBranch,
      headBranch: info.sourceBranch,
      diffSummary: diff.slice(0, 500),
      status: "pending",
    },
    update: { status: "pending", diffSummary: diff.slice(0, 500) },
  });

  // Trigger AI analysis
  const analysisRes = await fetch(`${ANALYZER_URL}/v1/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, reviewId: review.id, diff, language: "unknown", provider: "azure_devops" }),
  });

  if (!analysisRes.ok) {
    app.log.error("[ADO] Failed to trigger analysis");
    return;
  }

  const { data: analysisData } = await analysisRes.json() as { data: { analysisId: string } };

  // Poll for result
  let result: { output?: { summary?: string; riskScore?: number; comments?: unknown[] } } | null = null;
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const pollRes = await fetch(`${ANALYZER_URL}/v1/analyze/${analysisData.analysisId}`);
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json() as { data: { status: string; output?: unknown } };
    if (pollData.data.status === "completed") {
      result = pollData.data as { output?: { summary?: string; riskScore?: number; comments?: unknown[] } };
      break;
    }
    if (pollData.data.status === "failed") break;
  }

  if (!result?.output) {
    app.log.warn("[ADO] Analysis timed out or failed");
    return;
  }

  const output = result.output as { summary: string; riskScore: number; comments?: Array<{ type: string; severity: string; message: string; suggestion?: string; file?: string }> };

  // Post comment to PR
  const comment = formatAdoReviewComment(output);
  await postAdoPrComment(info.organizationUrl, info.projectId, info.repositoryId, info.pullRequestId, pat, comment);

  // Update PR status
  const state = output.riskScore >= 70 ? "failed" : "succeeded";
  if (info.commitId) {
    await updateAdoPrStatus(
      info.organizationUrl, info.projectId, info.repositoryId,
      info.pullRequestId, info.commitId, pat,
      state, `Kyntra: Risk score ${output.riskScore}/100`
    );
  }

  // Update review record
  await prisma.codeReview.update({
    where: { id: review.id },
    data: { riskScore: output.riskScore, status: "completed", analysisId: analysisData.analysisId },
  });

  app.log.info(`[ADO] PR #${info.pullRequestId} review complete \u2014 risk ${output.riskScore}/100`);
}
