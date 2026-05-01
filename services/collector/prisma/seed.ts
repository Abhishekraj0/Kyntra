import { PrismaClient } from "@prisma/client";
import { generateId } from "@kyntra/shared";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("Seeding database...");

  const project = await prisma.project.upsert({
    where: { slug: "demo-project" },
    update: {},
    create: {
      id: generateId(),
      name: "Demo Project",
      slug: "demo-project",
      apiKey: "kyn_demo_" + generateId(),
      githubRepoUrl: "https://github.com/example/demo-app",
      settings: {
        enableAiReviews: true,
        enableTestGeneration: true,
        enableAnomalyDetection: true,
        dataRetentionDays: 30,
        alertThresholds: {
          errorRatePercent: 5,
          latencyP99Ms: 2000,
          healthScoreMin: 70,
        },
        maskedFields: ["password", "token", "secret"],
      },
    },
  });

  console.log(`Created project: ${project.name} (API Key: ${project.apiKey})`);
  console.log("Seeding complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
