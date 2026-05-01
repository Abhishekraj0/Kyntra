/**
 * Bitbucket Cloud integration for Kyntra.
 * Handles webhook verification and PR comment posting via Bitbucket REST API v2.
 */
import { createHmac, timingSafeEqual } from "crypto";

const BB_API = "https://api.bitbucket.org/2.0";

export interface BitbucketPrEvent {
  event: string; // "pullrequest:created" | "pullrequest:updated" | "pullrequest:fulfilled"
  actor: { uuid: string; display_name: string; account_id: string };
  pullrequest: {
    id: number;
    title: string;
    description: string;
    author: { display_name: string; account_id: string; uuid: string };
    source: { branch: { name: string }; commit: { hash: string }; repository: { full_name: string } };
    destination: { branch: { name: string }; repository: { full_name: string } };
    links: { html: { href: string }; self: { href: string } };
    state: string;
  };
  repository: {
    full_name: string;
    name: string;
    links: { html: { href: string } };
    workspace: { slug: string };
  };
}

/**
 * Verify a Bitbucket webhook using HMAC-SHA256.
 * Bitbucket signs the payload with the webhook secret and sends it in X-Hub-Signature.
 */
export function verifyBitbucketWebhook(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const actual = signature.replace(/^sha256=/i, "");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
  } catch {
    return false;
  }
}

/**
 * Get a pull request diff from Bitbucket.
 */
export async function getBitbucketPrDiff(
  workspace: string,
  repoSlug: string,
  prId: number,
  accessToken: string
): Promise<string> {
  const url = `${BB_API}/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/diffstat`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) throw new Error(`Bitbucket diffstat failed: ${res.status}`);

  const data = await res.json() as { values: Array<{ status: string; new?: { path: string }; old?: { path: string } }> };
  const lines = data.values.map(
    (f) => `${f.status.toUpperCase()}: ${f.new?.path ?? f.old?.path ?? "unknown"}`
  );

  return lines.join("\n") || "No file changes.";
}

/**
 * Post a comment on a Bitbucket pull request.
 */
export async function postBitbucketPrComment(
  workspace: string,
  repoSlug: string,
  prId: number,
  accessToken: string,
  comment: string
): Promise<void> {
  const url = `${BB_API}/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: { raw: comment } }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bitbucket comment post failed: ${res.status} \u2014 ${err}`);
  }
}

/**
 * Get an OAuth 2.0 access token from Bitbucket using client credentials
 * (App password flow: key=clientId, secret=clientSecret).
 */
export async function getBitbucketAccessToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://bitbucket.org/site/oauth2/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Bitbucket OAuth failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

export function extractBitbucketPrInfo(event: BitbucketPrEvent) {
  const repo = event.repository;
  const pr = event.pullrequest;
  const [workspace, repoSlug] = repo.full_name.split("/") as [string, string];

  return {
    workspace,
    repoSlug,
    repoFullName: repo.full_name,
    pullRequestId: pr.id,
    prTitle: pr.title,
    prAuthor: pr.author.display_name,
    prUrl: pr.links.html.href,
    sourceBranch: pr.source.branch.name,
    targetBranch: pr.destination.branch.name,
    commitHash: pr.source.commit.hash,
    repoUrl: repo.links.html.href,
  };
}
