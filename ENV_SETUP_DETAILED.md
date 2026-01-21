# 🚀 Nourose Environment Setup Guide

## Quick Start

### For Local Development:
```bash
# 1. Copy the example file
cp .env.example .env.local

# 2. Edit .env.local and fill in your values
nano .env.local  # or use your favorite editor

# 3. Start development
npm run dev:full  # Runs Next.js, WebSocket, and ingest watcher
```

---

## Environment Files Explained

### 📁 `.env.example` (Committed to Git ✅)
- **What:** Template showing all required variables
- **Who:** All developers use this
- **Sensitive Data:** NO - example values only
- **Update:** When adding new config variables

### 📁 `.env.local` (NOT Committed ❌)
- **What:** Your actual local development configuration
- **Who:** Only you on your machine
- **Sensitive Data:** YES - your real secrets
- **Create from:** `cp .env.example .env.local`

### 📁 `.env.production.example` (Reference only)
- **What:** Example production configuration
- **Who:** DevOps/deployment team reference
- **Sensitive Data:** NO - example values only
- **For:** Understanding production requirements

---

## Setup Instructions

### Step 1: Generate NEXTAUTH_SECRET

**macOS/Linux:**
```bash
openssl rand -base64 32
```

**PowerShell (Windows):**
```powershell
[System.Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Output example:**
```
XK8m2jL9nQ4pR6sT8vW1xY2zAaBbCcDdEeFf
```

### Step 2: Get GitHub OAuth Credentials

1. Go to https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in:
   ```
   Application name:        Nourose Local Dev
   Homepage URL:            http://localhost:3000
   Authorization callback:  http://localhost:3000/api/auth/callback/github
   ```
4. Copy **Client ID** → `GITHUB_ID`
5. Click **"Generate a new client secret"** → `GITHUB_SECRET`

### Step 3: Create `.env.local`

```bash
cp .env.example .env.local
```

### Step 4: Edit `.env.local`

Fill in your actual values:

```env
# Database (SQLite for local dev)
DATABASE_URL="file:./prisma/dev.db"

# Auth secrets (from steps 1 & 2)
NEXTAUTH_SECRET="XK8m2jL9nQ4pR6sT8vW1xY2zAaBbCcDdEeFf"
NEXTAUTH_URL="http://localhost:3000"

# GitHub OAuth (from step 2)
GITHUB_ID="abc123xyz789"
GITHUB_SECRET="gho_16CjL5pA9xK8mN2oP4qR6sT9u1vW3xY5"

# Keep the rest as defaults for local development
```

### Step 5: Initialize Database

```bash
npx prisma migrate dev
```

### Step 6: Start Development

```bash
npm run dev:full
```

This runs:
- ✅ Next.js on http://localhost:3000
- ✅ WebSocket server on http://localhost:8080
- ✅ Ingest watcher for auto-processing files

---

## Local Development Checklist

- [ ] Copied `.env.example` to `.env.local`
- [ ] Generated `NEXTAUTH_SECRET` with openssl
- [ ] Created GitHub OAuth app
- [ ] Added `GITHUB_ID` and `GITHUB_SECRET`
- [ ] Ran `npx prisma migrate dev`
- [ ] Started with `npm run dev:full`
- [ ] Can login with GitHub at http://localhost:3000
- [ ] Can upload images/videos in admin panel
- [ ] Ingest watcher detects new files in `/public/ingest`

---

## Production Deployment Checklist

When deploying to production:

### 1. Create Production Secrets

Use your hosting provider's secret manager (Vercel, Heroku, AWS Secrets, etc.):

```bash
# Example: Vercel
vercel env add DATABASE_URL
vercel env add NEXTAUTH_SECRET
vercel env add GITHUB_ID
vercel env add GITHUB_SECRET
# ... etc for all variables
```

### 2. Use PostgreSQL

```env
DATABASE_URL="postgresql://user:password@host:5432/database"
```

### 3. Update Domain URLs

```env
NEXTAUTH_URL="https://yourdomain.com"
GITHUB_ID="prod-github-id"
GITHUB_SECRET="prod-github-secret"
```

### 4. Run Database Migrations

```bash
npx prisma migrate deploy
```

### 5. Important Production Settings

```env
NODE_ENV="production"
LOG_LEVEL="warn"
BCRYPT_ROUNDS="14"
RATE_LIMIT_PER_MINUTE="50"
ENABLE_USER_REGISTRATION="false"
```

---

## Environment Variable Reference

### Database

| Variable | Local | Production | Required |
|----------|-------|-----------|----------|
| `DATABASE_URL` | SQLite file path | PostgreSQL URI | ✅ Yes |

### Authentication

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXTAUTH_SECRET` | Session encryption key | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your app's URL | `http://localhost:3000` |
| `GITHUB_ID` | GitHub OAuth Client ID | `abc123xyz789` |
| `GITHUB_SECRET` | GitHub OAuth Secret | `gho_16CjL5pA9xK8mN2oP4qR6...` |

### File Processing

| Variable | Default | Notes |
|----------|---------|-------|
| `MAX_FILE_SIZE` | `500` MB | Local limit |
| `IMAGE_QUALITY` | `85` | 1-100 scale |
| `WEBP_QUALITY` | `80` | Compressed quality |
| `ENABLE_VIDEO_PROCESSING` | `true` | Requires ffmpeg |

### Real-time Updates

| Variable | Local | Production |
|----------|-------|-----------|
| `WS_SERVER_HOST` | `localhost` | `0.0.0.0` |
| `WS_SERVER_PORT` | `8080` | `8080` |

---

## Common Issues & Solutions

### ❌ Error: `NEXTAUTH_SECRET is undefined`
**Solution:** Add `NEXTAUTH_SECRET` to `.env.local`
```env
NEXTAUTH_SECRET="your-generated-secret"
```

### ❌ GitHub OAuth login not working
**Solution:** Check your callback URL matches:
```
https://github.com/settings/developers
→ Authorization callback URL: http://localhost:3000/api/auth/callback/github
```

### ❌ "Database connection refused"
**Solution:** For local dev, ensure database file can be created:
```bash
touch prisma/dev.db  # Create file manually if needed
npx prisma migrate dev
```

### ❌ WebSocket connection fails
**Solution:** Make sure WebSocket server is running:
```bash
npm run ws-server  # Or use: npm run dev:full
```

### ❌ "Video processing not working"
**Solution:** Install ffmpeg
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows (using chocolatey)
choco install ffmpeg
```

---

## Security Best Practices

### ✅ DO:
- Keep `.env.local` in `.gitignore`
- Regenerate `NEXTAUTH_SECRET` for each environment
- Use strong passwords/secrets (20+ characters)
- Rotate OAuth tokens every 90 days
- Use PostgreSQL in production (not SQLite)
- Enable HTTPS in production
- Set `ENABLE_USER_REGISTRATION="false"` in production

### ❌ DON'T:
- Commit `.env.local` to Git
- Share secrets in Slack/Email
- Reuse secrets across environments
- Hardcode secrets in code
- Use weak passwords
- Store production secrets in Git
- Log sensitive data

---

## Deploying to Vercel

1. Push code to GitHub (without `.env.local`)
2. Import project on Vercel
3. Add environment variables:
   ```
   Settings → Environment Variables
   Add: DATABASE_URL, NEXTAUTH_SECRET, GITHUB_ID, GITHUB_SECRET
   ```
4. Deploy!

---

## Deploying to Heroku

1. Create app:
   ```bash
   heroku create nourose
   ```

2. Add PostgreSQL:
   ```bash
   heroku addons:create heroku-postgresql:standard-0
   ```

3. Set environment variables:
   ```bash
   heroku config:set NEXTAUTH_SECRET="your-secret"
   heroku config:set DATABASE_URL="<auto-set by addon>"
   heroku config:set GITHUB_ID="prod-id"
   heroku config:set GITHUB_SECRET="prod-secret"
   ```

4. Deploy:
   ```bash
   git push heroku main
   ```

---

## Local vs Production Comparison

| Aspect | Local | Production |
|--------|-------|----------|
| Database | SQLite | PostgreSQL |
| URL | `http://localhost:3000` | `https://nourose.com` |
| Secrets | In `.env.local` | In provider's secrets manager |
| WebSocket | `localhost:8080` | `wss://ws.nourose.com` |
| Rate Limit | `100/min` | `50/min` |
| Registration | Enabled | Disabled |
| Logging | Verbose | Minimal |

---

## Questions?

Refer to:
- `.env.example` - All available variables
- `.env.production.example` - Production setup
- `ENV_SETUP.md` - Detailed explanations

Good luck! 🚀
