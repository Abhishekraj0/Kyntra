import { PrismaClient } from "@prisma/client";
import { getAIClient, CLAUDE_MODEL, MAX_TOKENS } from "../ai/client.js";
import { SYSTEM_PROMPTS, buildTestGenerationPrompt } from "../ai/prompts.js";
import { generateId } from "@kyntra/shared";
import type { TestGenerationOutput } from "@kyntra/shared";

export async function generateTests(
  prisma: PrismaClient,
  projectId: string,
  endpointId: string,
  framework: "jest" | "vitest" = "vitest"
): Promise<TestGenerationOutput> {
  const endpoint = await prisma.apiEndpoint.findUnique({
    where: { id: endpointId },
  });

  if (!endpoint) {
    throw new Error(`Endpoint ${endpointId} not found`);
  }

  // Get sample traces for this endpoint
  const traces = await prisma.apiTrace.findMany({
    where: { projectId, path: endpoint.path, method: endpoint.method },
    select: {
      requestBody: true,
      responseBody: true,
      statusCode: true,
      url: true,
    },
    orderBy: { timestamp: "desc" },
    take: 10,
  });

  const baseUrl = traces[0]?.url
    ? new URL(traces[0].url).origin
    : "http://localhost:3000";

  const client = getAIClient();

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS * 2,
    system: SYSTEM_PROMPTS.TEST_GENERATION,
    messages: [
      {
        role: "user",
        content: buildTestGenerationPrompt({
          endpoint: endpoint.path,
          method: endpoint.method,
          baseUrl,
          sampleTraces: traces.map((t: any) => ({
            requestBody: t.requestBody,
            responseBody: t.responseBody,
            statusCode: t.statusCode,
          })),
          framework,
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

  const result = JSON.parse(jsonMatch[0]) as TestGenerationOutput;

  // Save generated test case to DB
  await prisma.testCase.create({
    data: {
      id: generateId(),
      projectId,
      endpointId,
      name: `${endpoint.method} ${endpoint.path} — generated tests`,
      description: `Auto-generated ${framework} test suite`,
      type: "integration",
      framework,
      code: result.testFile.content,
      status: "pending",
    },
  });

  return result;
}
