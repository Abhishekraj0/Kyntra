import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import { generateId } from "@kyntra/shared";
import type { GithubPullRequestPayload } from "@kyntra/shared";
import {
  verifyWebhookSignature,
  getInstallationToken,
  getPullRequestDiff,
  getPullRequestFiles,
  detectLanguageFromFiles,
} from "../services/github-app.js";
import {
  postPrReviewSummary,
  postInlineReviewComments,
  updatePrCheckStatus,
} from "../services/github-comments.js";

const ANALYZER_URL = process.env["ANALYZER_URL"] ?? "http://localhost:3002";

export async function githubRoutes(
  app: FastifyInstance,
  { prisma }: { prisma: PrismaClient }
): Promise<void> {
  // Main webhook endpoint
  app.post("/v1/github/webhook", async (req: FastifyRequest, reply: FastifyReply) => {
    const event = req.headers["x-github-event"] as string;
    const signature = req.headers["x-hub-signature-256"] as string;
    const webhookSecret = process.env["GITHUB_WEBHOOK_SECRET"];

    // Verify signature
    if (webhookSecret && signature) {
      const rawBody = JSON.stringify(req.body);
      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        return reply.status(401).send({ error: "Invalid webhook signature" });
      }
    }

    if (event !== "pull_request") {
      return reply.status(200).send({ skipped: true, reason: `Event '${event}' not handled` });
    }

    const payload = req.body as GithubPullRequestPayload;
    const { action, pull_request: pr, repository, installation } = payload;

    if (action !== "opened" && action !== "synchronize") {
      return reply.status(200).send({ skipped: true, reason: `Action '${action}' not handled` });
    }

    // Find matching project
    const project = await prisma.project.findFirst({
      where: { githubRepoUrl: { contains: repository.full_name } },
    });

    if (!project) {
      return reply.status(200).send({ skipped: true, reason: "No project matched this repository" });
    }

    // Get installation token (for GitHub App) or fall back to PAT
    let token: string;
    const appId = process.env["GITHUB_APP_ID"];
    const privateKey = process.env["GITHUB_APP_PRIVATE_KEY"];

    if (appId && privateKey && installation?.id) {
      try {
        token = await getInstallationToken(installation.id, appId, privateKey);
      } catch {
        token = process.env["GITHUB_TOKEN"] ?? "";
      }
    } else {
      token = process.env["GITHUB_TOKEN"] ?? "";
    }

    // Fetch PR diff and files
    let diff = "";
    let language = "typescript";
    let framework: string | undefined;

    try {
      const [diffText, files] = await Promise.all([
        getPullRequestDiff(repository.full_name, pr.number, token),
        getPullRequestFiles(repository.full_name, pr.number, token),
      ]);
      diff = diffText;
      const detected = detectLanguageFromFiles(files);
      language = detected.language;
      framework = detected.framework;
    } catch (err) {
      app.log.warn(`Failed to fetch PR diff for ${repository.full_name}#${pr.number}: ${String(err)}`);
      diff = "Could not fetch diff";
    }

    // Create or update code review record
    const review = await prisma.codeReview.upsert({
      where: { projectId_prNumber: { projectId: project.id, prNumber: pr.number } },
      create: {
        id: generateId(),
        projectId: project.id,
        prNumber: pr.number,
        prUrl: pr.html_url,
        prTitle: pr.title,
        prAuthor: pr.user.login,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
        status: "analyzing",
      },
      update: { prTitle: pr.title, status: "analyzing", updatedAt: new Date() },
    });

    // Trigger analysis in analyzer service
    const analysisRes = await fetch(`${ANALYZER_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "code_review",
        projectId: project.id,
        options: {
          reviewId: review.id,
          diff,
          prTitle: pr.title,
          prDescription: pr.body,
          language,
          framework,
        },
      }),
    });

    const analysisData = await analysisRes.json() as { analysisId: string };

    // Post pending check status
    if (token) {
      await updatePrCheckStatus(
        repository.full_name,
        pr.head.sha,
        token,
        0,
        "Kyntra AI review in progress..."
      ).catch(() => undefined);
    }

    // Background: poll for completion and post comments
    void postReviewWhenComplete(
      prisma,
      analysisData.analysisId,
      review.id,
      repository.full_name,
      pr.number,
      pr.head.sha,
      token
    );

    app.log.info(
      `Triggered review for ${repository.full_name}#${pr.number} (analysisId: ${analysisData.analysisId})`
    );

    return reply.send({ queued: true, reviewId: review.id, analysisId: analysisData.analysisId });
  });

  // Manual review trigger endpoint
  app.post("/v1/github/review", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      projectId: string;
      repoFullName: string;
      prNumber: number;
      headSha: string;
    };

    const project = await prisma.project.findUnique({ where: { id: body.projectId } });
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const token = process.env["GITHUB_TOKEN"] ?? "";
    if (!token) return reply.status(400).send({ error: "GITHUB_TOKEN not configured" });

    const [diff, files] = await Promise.all([
      getPullRequestDiff(body.repoFullName, body.prNumber, token),
      getPullRequestFiles(body.repoFullName, body.prNumber, token),
    ]);

    const { language, framework } = detectLanguageFromFiles(files);

    const review = await prisma.codeReview.upsert({
      where: { projectId_prNumber: { projectId: project.id, prNumber: body.prNumber } },
      create: {
        id: generateId(),
        projectId: project.id,
        prNumber: body.prNumber,
        prUrl: `https://github.com/${body.repoFullName}/pull/${body.prNumber}`,
        prTitle: `PR #${body.prNumber}`,
        status: "analyzing",
      },
      update: { status: "analyzing" },
    });

    const analysisRes = await fetch(`${ANALYZER_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "code_review",
        projectId: project.id,
        options: { reviewId: review.id, diff, prTitle: `PR #${body.prNumber}`, language, framework },
      }),
    });

    const { analysisId } = await analysisRes.json() as { analysisId: string };

    void postReviewWhenComplete(
      prisma, analysisId, review.id,
      body.repoFullName, body.prNumber, body.headSha, token
    );

    return reply.send({ reviewId: review.id, analysisId });
  });
}

/**
 * Poll for completed analysis then post GitHub PR comments.
 */
async function postReviewWhenComplete(
  prisma: PrismaClient,
  analysisId: string,
  reviewId: string,
  repoFullName: string,
  prNumber: number,
  headSha: string,
  token: string
): Promise<void> {
  if (!token) return;

  for (let attempt = 0; attempt < 45; attempt++) {
    await new Promise((r) => setTimeout(r, 4000));

    try {
      const analysis = await prisma.analysisResult.findUnique({ where: { id: analysisId } });
      if (!analysis || analysis.status === "pending" || analysis.status === "running") continue;

      if (analysis.status === "complete" && analysis.output) {
        const output = analysis.output as {
          riskScore: number;
          summary: string;
          comments: Array<{
            filePath: string; lineStart: number; lineEnd: number;
            severity: string; category: string; message: string;
            suggestion?: string; autoFixable: boolean;
          }>;
          positives?: string[];
          suggestedTests?: string[];
        };

        // Post summary comment
        await postPrReviewSummary(repoFullName, prNumber, token, output as Parameters<typeof postPrReviewSummary>[3], output.riskScore);

        // Post inline comments (critical + high only)
        await postInlineReviewComments(
          repoFullName, prNumber, headSha, token,
          output.comments as Parameters<typeof postInlineReviewComments>[4]
        );

        // Update check status
        await updatePrCheckStatus(repoFullName, headSha, token, output.riskScore, output.summary);

        // Update review record
        await prisma.codeReview.update({
          where: { id: reviewId },
          data: { status: "complete", riskScore: output.riskScore, diffSummary: output.summary },
        });
      } else {
        await updatePrCheckStatus(repoFullName, headSha, token, 0, "Kyntra analysis failed.");
      }

      break;
    } catch (err) {
      console.error("Error posting review:", err);
    }
  }
}
