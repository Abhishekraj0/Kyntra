/**
 * GitHub App client for Kyntra.
 * Handles GitHub API authentication and app operations.
 */
import { createHmac, createSign } from "crypto";

const GITHUB_API = "https://api.github.com";

export interface GithubAppConfig {
  appId: string;
  privateKey: string;
  webhookSecret: string;
}

interface JwtPayload {
  iat: number;
  exp: number;
  iss: string;
}

/**
 * Generate a GitHub App JWT for authentication.
 * GitHub Apps use RS256-signed JWTs to get installation tokens.
 */
function generateJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = { iat: now - 60, exp: now + 600, iss: appId };

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${header}.${body}`;

  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(privateKey, "base64url");

  return `${signingInput}.${signature}`;
}

/**
 * Get an installation access token for a GitHub App installation.
 */
export async function getInstallationToken(
  installationId: number,
  appId: string,
  privateKey: string
): Promise<string> {
  const jwt = generateJwt(appId, privateKey);

  const response = await fetch(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Kyntra/1.0",
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get installation token: ${response.status} ${text}`);
  }

  const data = await response.json() as { token: string };
  return data.token;
}

/**
 * Verify a GitHub webhook signature.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Get the diff for a pull request.
 */
export async function getPullRequestDiff(
  repoFullName: string,
  prNumber: number,
  token: string
): Promise<string> {
  const response = await fetch(
    `${GITHUB_API}/repos/${repoFullName}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.diff",
        "User-Agent": "Kyntra/1.0",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch PR diff: ${response.status}`);
  }

  return response.text();
}

/**
 * Get PR files list (for language detection).
 */
export async function getPullRequestFiles(
  repoFullName: string,
  prNumber: number,
  token: string
): Promise<Array<{ filename: string; status: string; additions: number; deletions: number }>> {
  const response = await fetch(
    `${GITHUB_API}/repos/${repoFullName}/pulls/${prNumber}/files`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Kyntra/1.0",
      },
    }
  );

  if (!response.ok) return [];

  return response.json() as Promise<Array<{ filename: string; status: string; additions: number; deletions: number }>>;
}

/**
 * Detect the primary language/framework from PR files.
 */
export function detectLanguageFromFiles(
  files: Array<{ filename: string }>
): { language: string; framework?: string } {
  const names = files.map((f) => f.filename.toLowerCase());

  if (names.some((f) => f.endsWith(".ts") || f.endsWith(".tsx"))) {
    const framework = names.some((f) => f.includes("next.config") || f.includes("/pages/") || f.includes("/app/"))
      ? "Next.js"
      : names.some((f) => f.includes("react"))
      ? "React"
      : undefined;
    return { language: "typescript", ...(framework ? { framework } : {}) };
  }
  if (names.some((f) => f.endsWith(".js") || f.endsWith(".jsx"))) {
    return { language: "javascript" };
  }
  if (names.some((f) => f.endsWith(".py"))) return { language: "python" };
  if (names.some((f) => f.endsWith(".go"))) return { language: "go" };
  if (names.some((f) => f.endsWith(".java"))) return { language: "java" };
  if (names.some((f) => f.endsWith(".rs"))) return { language: "rust" };

  return { language: "unknown" };
}
