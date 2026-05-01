import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { generateId } from "@kyntra/shared";
import { performCodeReview } from "../analyzers/code-review.js";

const ReviewRequestSchema = z.object({
  projectId: z.string(),
  prNumber: z.number().int(),
  prUrl: z.string().url(),
  prTitle: z.string(),
  prAuthor: z.string().default(""),
  baseBranch: z.string().default("main"),
  headBranch: z.string().default(""),
  diff: z.string(),
  description: z.string().optional(),
  language: z.string().default("typescript"),
  framework: z.string().optional(),
});

export async function reviewRoutes(app: FastifyInstance, { prisma }: { prisma: PrismaClient }): Promise<void> {
  app.post(
    "/reviews",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = ReviewRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const {
        projectId, prNumber, prUrl, prTitle, prAuthor,
        baseBranch, headBranch, diff, description, language, framework,
      } = parsed.data;

      // Create or update code review record
      const review = await prisma.codeReview.upsert({
        where: { projectId_prNumber: { projectId, prNumber } },
        create: {
          id: generateId(),
          projectId,
          prNumber,
          prUrl,
          prTitle,
          prAuthor,
          baseBranch,
          headBranch,
          status: "analyzing",
        },
        update: {
          prTitle,
          status: "analyzing",
          updatedAt: new Date(),
        },
      });

      // Run review asynchronously
      void (async () => {
        try {
          await performCodeReview(prisma, review.id, diff, prTitle, description, language, framework);
        } catch (err) {
          await prisma.codeReview.update({
            where: { id: review.id },
            data: { status: "failed" },
          });
        }
      })();

      return reply.status(202).send({ reviewId: review.id, status: "analyzing" });
    }
  );

  app.get(
    "/reviews/:reviewId",
    async (req: FastifyRequest<{ Params: { reviewId: string } }>, reply: FastifyReply) => {
      const review = await prisma.codeReview.findUnique({
        where: { id: req.params.reviewId },
      });

      if (!review) {
        return reply.status(404).send({ error: "Review not found" });
      }

      return reply.send(review);
    }
  );
}
