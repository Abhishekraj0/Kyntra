/**
 * Slack, PagerDuty, MS Teams, and webhook notification service for Kyntra alerts.
 */

import type { Severity } from "@kyntra/shared";

const SEVERITY_SLACK_COLOR: Record<Severity, string> = {
  critical: "#FF0000",
  high: "#FF6600",
  medium: "#FFCC00",
  low: "#0099FF",
  info: "#999999",
};

const SEVERITY_PAGERDUTY_SEVERITY: Record<Severity, string> = {
  critical: "critical",
  high: "error",
  medium: "warning",
  low: "info",
  info: "info",
};

export interface NotificationPayload {
  ruleName: string;
  message: string;
  severity: Severity;
  projectName: string;
  projectId: string;
  triggeredAt: string;
  details?: Record<string, unknown>;
  dashboardUrl?: string;
}

/** @deprecated Use NotificationPayload instead */
export type AlertNotificationPayload = NotificationPayload;

// ── Slack ────────────────────────────────────────────

/**
 * Send a Slack notification via incoming webhook.
 */
export async function sendSlackNotification(
  webhookUrl: string,
  payload: NotificationPayload
): Promise<void> {
  const color = SEVERITY_SLACK_COLOR[payload.severity] ?? "#999";

  const body = {
    text: `*Kyntra Alert: ${payload.ruleName}*`,
    attachments: [
      {
        color,
        fields: [
          { title: "Project", value: payload.projectName, short: true },
          { title: "Severity", value: payload.severity.toUpperCase(), short: true },
          { title: "Message", value: payload.message, short: false },
          {
            title: "Triggered At",
            value: new Date(payload.triggeredAt).toLocaleString(),
            short: true,
          },
          ...(payload.dashboardUrl
            ? [{ title: "Dashboard", value: `<${payload.dashboardUrl}|View in Kyntra>`, short: true }]
            : []),
        ],
        footer: "Kyntra Engineering Intelligence",
        ts: Math.floor(new Date(payload.triggeredAt).getTime() / 1000).toString(),
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status} ${await response.text()}`);
  }
}

// ── PagerDuty ──────────────────────────────────────────

/**
 * Send a PagerDuty event via Events API v2.
 */
export async function sendPagerDutyEvent(
  integrationKey: string,
  payload: NotificationPayload
): Promise<void> {
  const body = {
    routing_key: integrationKey,
    event_action: "trigger",
    dedup_key: `kyntra-${payload.projectId}-${payload.ruleName.toLowerCase().replace(/\s+/g, "-")}`,
    payload: {
      summary: `[Kyntra] ${payload.ruleName}: ${payload.message}`,
      severity: SEVERITY_PAGERDUTY_SEVERITY[payload.severity] ?? "warning",
      source: `kyntra/${payload.projectName}`,
      timestamp: payload.triggeredAt,
      custom_details: {
        project_id: payload.projectId,
        rule_name: payload.ruleName,
        ...(payload.details ?? {}),
      },
    },
    links: payload.dashboardUrl
      ? [{ href: payload.dashboardUrl, text: "View in Kyntra Dashboard" }]
      : [],
  };

  const response = await fetch("https://events.pagerduty.com/v2/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`PagerDuty event failed: ${response.status} ${await response.text()}`);
  }
}

// ── Generic Webhook ────────────────────────────────────────────────────

export async function sendWebhookNotification(
  url: string,
  secret: string | undefined,
  payload: NotificationPayload
): Promise<void> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Kyntra/1.0",
    "X-Kyntra-Event": "alert.triggered",
  };

  if (secret) {
    const { createHmac } = await import("crypto");
    headers["X-Kyntra-Signature"] = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  }

  const response = await fetch(url, { method: "POST", headers, body });

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status}`);
  }
}

// ── MS Teams ─────────────────────────────────────────────────────────────

/**
 * Send a Microsoft Teams notification via Incoming Webhook using Adaptive Cards format.
 * Header color reflects alert severity:
 *   critical  -> "attention" (red)
 *   high      -> "warning"   (orange/yellow)
 *   medium/low/info -> "accent" (blue)
 */
export async function sendTeamsNotification(
  webhookUrl: string,
  payload: NotificationPayload
): Promise<void> {
  const color =
    payload.severity === "critical"
      ? "attention"
      : payload.severity === "high"
        ? "warning"
        : "accent";

  const card = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              text: `🚨 Kyntra Alert — ${payload.ruleName}`,
              weight: "bolder",
              size: "medium",
              color,
            },
            {
              type: "TextBlock",
              text: payload.message,
              wrap: true,
              color,
            },
            {
              type: "FactSet",
              facts: [
                { title: "Project", value: payload.projectName },
                { title: "Severity", value: payload.severity.toUpperCase() },
                { title: "Triggered", value: new Date(payload.triggeredAt).toLocaleString() },
              ],
            },
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: "View in Kyntra",
              url: payload.dashboardUrl,
            },
          ],
        },
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Teams notification failed: ${res.status} — ${text}`);
  }
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export type AlertChannel =
  | { type: "slack"; webhookUrl: string }
  | { type: "pagerduty"; integrationKey: string }
  | { type: "webhook"; url: string; secret?: string }
  | { type: "email"; to: string }
  | { type: "teams"; webhookUrl: string };

/**
 * Send notifications to all configured channels for an alert.
 */
export async function notifyAllChannels(
  channels: AlertChannel[],
  payload: NotificationPayload
): Promise<{ channel: string; success: boolean; error?: string }[]> {
  const results = await Promise.allSettled(
    channels.map(async (channel) => {
      switch (channel.type) {
        case "slack":
          if (!channel.webhookUrl) throw new Error("Slack webhookUrl not configured");
          await sendSlackNotification(channel.webhookUrl, payload);
          break;
        case "pagerduty":
          if (!channel.integrationKey) throw new Error("PagerDuty integrationKey not configured");
          await sendPagerDutyEvent(channel.integrationKey, payload);
          break;
        case "webhook":
          if (!channel.url) throw new Error("Webhook url not configured");
          await sendWebhookNotification(channel.url, channel.secret, payload);
          break;
        case "teams":
          if (!channel.webhookUrl) throw new Error("Teams webhookUrl not configured");
          await sendTeamsNotification(channel.webhookUrl, payload);
          break;
        case "email":
          // Email integration — would use SendGrid/SES in production
          console.log(`[Notifications] Email to ${channel.to}: ${payload.message}`);
          break;
      }
      return channel.type;
    })
  );

  return results.map((result, i) => ({
    channel: channels[i]!.type,
    success: result.status === "fulfilled",
    ...(result.status === "rejected" ? { error: String(result.reason) } : {}),
  }));
}
