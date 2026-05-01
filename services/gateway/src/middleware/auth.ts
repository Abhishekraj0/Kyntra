import type { FastifyInstance } from "fastify";

export async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorate("authenticate", async function (request: { headers: { authorization?: string } }, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    // Full JWT implementation for production
    return;
  });
}
