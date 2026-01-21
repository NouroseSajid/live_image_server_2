# Development Environment Setup Guide

## What is `.env.example`?

The `.env.example` file is a **template** that shows all the environment variables your application needs. It's **committed to Git** so all developers know what variables they need to set.

The **actual `.env.local`** file contains real values and is **NOT committed to Git** (it's in `.gitignore`).

---

## Setup Instructions

### 1. Copy the example file
```bash
cp .env.example .env.local
```

### 2. Fill in your actual values

Edit `.env.local` with your real configuration:

```env
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET="your-actual-secret-here"
NEXTAUTH_URL="http://localhost:3000"
GITHUB_ID="actual-github-id"
GITHUB_SECRET="actual-github-secret"
```

### 3. Generate NEXTAUTH_SECRET

```bash
# macOS/Linux
openssl rand -base64 32

# PowerShell (Windows)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 4. Get GitHub OAuth Credentials

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: "Nourose Local Dev"
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Copy the `Client ID` and generate a `Client Secret`
5. Add to `.env.local`:
   ```
   GITHUB_ID="your-client-id"
   GITHUB_SECRET="your-client-secret"
   ```

---

## File Structure

```
live_image_server/
├── .env.example        ✅ COMMITTED (Template, no secrets)
├── .env.local          ❌ NOT COMMITTED (Your actual secrets)
├── .env.production     ❌ NOT COMMITTED (Production secrets)
├── .gitignore          ✅ COMMITTED (Contains: .env.local, .env.production)
└── prisma/
    └── schema.prisma
```

---

## Environment-Specific Files

### Development
```bash
# .env.local
NODE_ENV="development"
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_URL="http://localhost:3000"
```

### Production
```bash
# .env.production
NODE_ENV="production"
DATABASE_URL="postgresql://user:password@db.example.com:5432/prod_db"
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="production-secret"
```

---

## Common Issues

### ❌ "NEXTAUTH_SECRET is undefined"
→ Add `NEXTAUTH_SECRET` to `.env.local`

### ❌ "GitHub OAuth failed"
→ Check your `GITHUB_ID` and `GITHUB_SECRET` are correct
→ Make sure callback URL matches: `http://localhost:3000/api/auth/callback/github`

### ❌ "Database connection refused"
→ Make sure `DATABASE_URL` path is correct
→ For SQLite: `file:./prisma/dev.db`
→ For PostgreSQL: `postgresql://user:password@localhost:5432/db_name`

---

## Security Best Practices

✅ **DO:**
- Keep `.env.local` out of version control
- Regenerate secrets regularly
- Use different secrets for dev/prod
- Rotate OAuth tokens periodically
- Never commit `.env.local` to Git

❌ **DON'T:**
- Share `.env.local` in chat/email
- Commit secrets to Git
- Use weak NEXTAUTH_SECRET
- Reuse OAuth credentials across projects
- Hardcode secrets in code

---

## Loading Environment Variables

Your app automatically loads from:
1. `.env.local` (development)
2. `.env.production` (production)
3. `.env` (fallback)
4. Environment variables set in system/Docker

---

## Example `.env.local` for Development

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# Authentication
NEXTAUTH_SECRET="generated-random-string-here"
NEXTAUTH_URL="http://localhost:3000"

# GitHub OAuth
GITHUB_ID="your-github-client-id"
GITHUB_SECRET="your-github-client-secret"

# File Processing
MAX_FILE_SIZE="500"
IMAGE_QUALITY="85"

# WebSocket
WS_SERVER_HOST="localhost"
WS_SERVER_PORT="8080"

# Environment
NODE_ENV="development"
LOG_LEVEL="info"
```

All set! You're ready to develop. 🚀
