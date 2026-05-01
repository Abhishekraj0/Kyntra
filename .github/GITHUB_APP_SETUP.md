# Kyntra GitHub App Setup

## Create the GitHub App

1. Go to **Settings → Developer settings → GitHub Apps → New GitHub App**
2. Fill in:
   - **GitHub App name:** Kyntra AI Review
   - **Homepage URL:** https://kyntra.io
   - **Webhook URL:** `https://your-domain.com/v1/github/webhook`
   - **Webhook secret:** Generate a secure random string

## Required Permissions

| Permission | Access |
|-----------|--------|
| Pull requests | Read & Write |
| Checks | Read & Write |
| Contents | Read |
| Issues | Write (for PR comments) |
| Metadata | Read |

## Subscribe to Events
- [x] Pull request

## After Creating

1. Generate a **private key** (PEM format) from the app settings page
2. Note the **App ID** from the app settings

## Environment Variables

Add to your `.env`:

```env
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your-random-secret-here
# For personal repos / testing without GitHub App:
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

## Install the App

1. Go to **Settings → GitHub Apps → Kyntra AI Review → Install App**
2. Select the repositories to monitor
3. After installation, Kyntra will automatically review all pull requests

## How It Works

```
PR opened/updated
      ↓
GitHub webhook → Kyntra Gateway (/v1/github/webhook)
      ↓
Fetch PR diff + detect language
      ↓
Queue AI code review (Analyzer service)
      ↓
Claude analyzes diff → risk score + comments
      ↓
Post review summary comment on PR
Post inline comments on critical/high issues
Update GitHub Check status
```
