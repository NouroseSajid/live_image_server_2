# ⚡ Quick Environment Setup Reference

## 3-Minute Setup

```bash
# 1. Copy template
cp .env.example .env.local

# 2. Generate secret (copy output)
openssl rand -base64 32

# 3. Edit .env.local
NEXTAUTH_SECRET="paste-output-here"
GITHUB_ID="from-github-settings"
GITHUB_SECRET="from-github-settings"

# 4. Start
npm run dev:full
```

---

## File Structure

```
.env.example          ← Copy this, commit to Git
.env.local            ← Your local secrets, in .gitignore
.env.production.example ← Reference for production
```

---

## Required Secrets

| Variable | Source | Length |
|----------|--------|--------|
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | 44 chars |
| `GITHUB_ID` | github.com/settings/developers | ~20 chars |
| `GITHUB_SECRET` | github.com/settings/developers | ~40 chars |

---

## GitHub OAuth Setup (2 minutes)

1. https://github.com/settings/developers → New OAuth App
2. **Application name:** `Nourose Local Dev`
3. **Homepage URL:** `http://localhost:3000`
4. **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
5. Copy: **Client ID** → `GITHUB_ID`
6. Generate secret → `GITHUB_SECRET`

---

## Local Development Values

```env
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="development"
LOG_LEVEL="info"
WS_SERVER_HOST="localhost"
WS_SERVER_PORT="8080"
```

---

## Production Values

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://yourdomain.com"
NODE_ENV="production"
LOG_LEVEL="warn"
WS_SERVER_HOST="0.0.0.0"
ENABLE_USER_REGISTRATION="false"
```

---

## Startup Commands

```bash
npm run dev         # Just Next.js
npm run dev:full    # Next.js + WebSocket + Ingest Watcher
npm run ws-server   # WebSocket server only
npm run ingest      # Ingest watcher only
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `NEXTAUTH_SECRET is undefined` | Add to `.env.local` |
| GitHub OAuth fails | Check callback URL |
| Database not found | `npx prisma migrate dev` |
| WebSocket error | Run `npm run ws-server` |

---

## Files to Create

1. `.env.local` - Copy from `.env.example`, add your secrets
2. That's it! Everything else is pre-configured.

---

## Security Reminders

✅ `.gitignore` includes `.env.local`
✅ `.env.example` has NO secrets
✅ Never commit `.env.local`
✅ Use strong `NEXTAUTH_SECRET`
✅ Different secrets for dev/prod

Good to go! 🚀
