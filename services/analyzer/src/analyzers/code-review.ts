import { PrismaClient } from "@prisma/client";
import { getAIClient, CLAUDE_MODEL, MAX_TOKENS } from "../ai/client.js";
import { SYSTEM_PROMPTS, buildCodeReviewPrompt } from "../ai/prompts.js";
import type { CodeReviewOutput } from "@kyntra/shared";

export async function performCodeReview(
  prisma: PrismaClient,
  reviewId: string,
  diff: string,
  prTitle: string,
  prDescription?: string,
  language = "typescript",
  framework?: string
): Promise<CodeReviewOutput> {
  const client = getAIClient();

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS * 2,
    system: SYSTEM_PROMPTS.CODE_REVIEW,
    messages: [
      {
        role: "user",
        content: buildCodeReviewPrompt({
          prTitle,
          ...(prDescription ? { prDescription } : {}),
          diff,
          language,
          ...(framework ? { framework } : {}),
        }),
      },
    ],
  });

  const content = message.content[0];
  if (!content || content.type !== "text") {
    throw new Error("Unexpected AI response format");
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in AI response");
  }

  const result = JSON.parse(jsonMatch[0]) as CodeReviewOutput;

  // Update the code review record
  await prisma.codeReview.update({
    where: { id: reviewId },
    data: {
      riskScore: result.riskScore,
      diffSummary: result.summary,
      status: "complete",
    },
  });

  return result;
}
