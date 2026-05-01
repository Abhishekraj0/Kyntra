/**
 * Azure DevOps integration for Kyntra.
 * Handles webhook verification and PR comment posting via Azure DevOps REST API.
 */
import { createHmac, timingSafeEqual } from "crypto";

const ADO_API_VERSION = "7.1-preview.1";

export interface AdoPullRequestEvent {
  eventType: string; // "git.pullrequest.created" | "git.pullrequest.updated"
  resource: {
    pullRequestId: number;
    title: string;
    description: string;
    createdBy: { uniqueName: string; displayName: string };
    sourceRefName: string; // refs/heads/feature/xxx
    targetRefName: string; // refs/heads/main
    status: string;
    url: string;
    repository: {
      id: string;
      name: string;
      url: string;
      project: { id: string; name: string };
      remoteUrl: string;
    };
    lastMergeCommit?: { commitId: string };
    codeReviewId: number;
  };
  resourceContainers: {
    account: { baseUrl: string }; // https://dev.azure.com/orgname
  };
}

export interface AdoConfig {
  organizationUrl: string; // https://dev.azure.com/myorg
  personalAccessToken: string; // base64-encoded PAT
  webhookSecret?: string;
}

/**
 * Verify Azure DevOps service hook shared secret.
 * ADO sends a basicAuthPassword in the Authorization header.
 */
export function verifyAdoWebhook(
  authHeader: string | undefined,
  webhookSecret: string
): boolean {
  if (!authHeader) return false;
  // Azure DevOps uses Basic auth with the webhook secret as password
  const b64 = authHeader.replace(/^Basic\s+/i, "");
  try {
    const decoded = Buffer.from(b64, "base64").toString("utf-8");
    const password = decoded.split(":")[1] ?? decoded;
    const expected = Buffer.from(webhookSecret);
    const actual = Buffer.from(password);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/**
 * Get a pull request diff by fetching the changes from the ADO API.
 */
export async function getAdoPullRequestDiff(
  organizationUrl: string,
  projectId: string,
  repositoryId: string,
  pullRequestId: number,
  pat: string
): Promise<string> {
  const authHeader = "Basic " + Buffer.from(`:${pat}`).toString("base64");
  const url = `${organizationUrl}/${projectId}/_apis/git/repositories/${repositoryId}/pullRequests/${pullRequestId}/iterations?api-version=${ADO_API_VERSION}`;

  const iterRes = await fetch(url, { headers: { Authorization: authHeader, "Content-Type": "application/json" } });
  if (!iterRes.ok) throw new Error(`ADO iterations fetch failed: ${iterRes.status}`);

  const iterations = (await iterRes.json() as { value: Array<{ id: number }> }).value;
  if (!iterations.length) return "";

  const latestIteration = iterations[iterations.length - 1]!.id;
  const changesUrl = `${organizationUrl}/${projectId}/_apis/git/repositories/${repositoryId}/pullRequests/${pullRequestId}/iterations/${latestIteration}/changes?api-version=${ADO_API_VERSION}`;

  const changesRes = await fetch(changesUrl, { headers: { Authorization: authHeader } });
  if (!changesRes.ok) throw new Error(`ADO changes fetch failed: ${changesRes.status}`);

  const changes = await changesRes.json() as { changeEntries: Array<{ item: { path: string; isFolder?: boolean }; changeType: string }> };
  const filePaths = changes.changeEntries
    .filter((c) => !c.item.isFolder)
    .map((c) => `${c.changeType}: ${c.item.path}`)
    .join("\n");

  return filePaths || "No file changes found.";
}

/**
 * Post a review comment thread to an Azure DevOps pull request.
 */
export async function postAdoPrComment(
  organizationUrl: string,
  projectId: string,
  repositoryId: string,
  pullRequestId: number,
  pat: string,
  comment: string
): Promise<void> {
  const authHeader = "Basic " + Buffer.from(`:${pat}`).toString("base64");
  const url = `${organizationUrl}/${projectId}/_apis/git/repositories/${repositoryId}/pullRequests/${pullRequestId}/threads?api-version=${ADO_API_VERSION}`;

  const body = {
    comments: [{ parentCommentId: 0, content: comment, commentType: 1 }],
    status: 1,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ADO comment post failed: ${res.status} \u2014 ${err}`);
  }
}

/**
 * Update a PR status in Azure DevOps (pass/fail check).
 */
export async function updateAdoPrStatus(
  organizationUrl: string,
  projectId: string,
  repositoryId: string,
  pullRequestId: number,
  commitId: string,
  pat: string,
  state: "succeeded" | "failed" | "pending",
  description: string
): Promise<void> {
  const authHeader = "Basic " + Buffer.from(`:${pat}`).toString("base64");
  const url = `${organizationUrl}/${projectId}/_apis/git/repositories/${repositoryId}/pullRequests/${pullRequestId}/statuses?api-version=${ADO_API_VERSION}`;

  const body = {
    state,
    description: description.slice(0, 140),
    context: { name: "kyntra", genre: "code-review" },
    targetUrl: `${organizationUrl}/${projectId}/_git/${repositoryId}/pullrequest/${pullRequestId}`,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ADO status update failed: ${res.status} \u2014 ${err}`);
  }
}

export function extractAdoRepoInfo(event: AdoPullRequestEvent) {
  const baseUrl = event.resourceContainers.account.baseUrl.replace(/\/$/, "");
  const repo = event.resource.repository;
  const project = repo.project;
  return {
    organizationUrl: baseUrl,
    projectId: project.id,
    projectName: project.name,
    repositoryId: repo.id,
    repositoryName: repo.name,
    pullRequestId: event.resource.pullRequestId,
    prTitle: event.resource.title,
    prAuthor: event.resource.createdBy.uniqueName,
    sourceBranch: event.resource.sourceRefName.replace("refs/heads/", ""),
    targetBranch: event.resource.targetRefName.replace("refs/heads/", ""),
    commitId: event.resource.lastMergeCommit?.commitId ?? "",
    repoUrl: repo.remoteUrl,
  };
}
