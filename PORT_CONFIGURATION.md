# WebSocket & Port Configuration Guide

## Overview

The application now uses environment variables for all port and host configurations, making it flexible for development and production deployments.

## Services & Their Ports

### 1. Next.js App (Frontend + API)
- **Default Port**: 3000
- **Environment Variables**:
  - `NEXT_APP_PORT` - Port where Next.js runs (default: 3000)
- **Override for conflicts**:
  ```bash
  PORT=3001 npm start
  ```

### 2. WebSocket Server (Real-time Updates)
- **Default Port**: 8080
- **Environment Variables**:
  - `WS_SERVER_HOST` - Host to bind to (default: "localhost", production: "0.0.0.0")
  - `WS_SERVER_PORT` - Port to listen on (default: "8080")
- **Location**: `scripts/ws-server.js`
- **Run**:
  ```bash
  npm run ws-server
  ```

### 3. Ingest Watcher (File Import)
- **No separate port** - connects to WebSocket server
- **Environment Variables**:
  - Reads `WS_SERVER_HOST` and `WS_SERVER_PORT`
- **Location**: `scripts/ingest-watcher.js`
- **Run**:
  ```bash
  npm run ingest
  ```

## Configuration for Different Environments

### Development (localhost)

**.env.local**:
```dotenv
# Next.js App
NEXTAUTH_URL="http://localhost:3000"
NEXT_APP_HOST="localhost"
NEXT_APP_PORT="3000"

# WebSocket Server
WS_SERVER_HOST="localhost"
WS_SERVER_PORT="8080"

# CORS
CORS_ORIGINS="http://localhost:3000"
```

**Run all services**:
```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: WebSocket Server
npm run ws-server

# Terminal 3: Ingest Watcher
npm run ingest
```

### Development with Port Conflict

If port 3000 is already in use:
```bash
PORT=3001 npm start
```

Also update `.env.local`:
```dotenv
NEXTAUTH_URL="http://localhost:3001"
NEXT_APP_PORT="3001"
```

### Production (Single Server)

**.env.production**:
```dotenv
# Next.js App
NEXTAUTH_URL="https://yourdomain.com"
NEXT_APP_HOST="localhost"
NEXT_APP_PORT="3000"

# WebSocket Server
WS_SERVER_HOST="0.0.0.0"
WS_SERVER_PORT="8080"

# CORS
CORS_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"
```

Use a reverse proxy (nginx) to:
- Forward `https://yourdomain.com` → `http://localhost:3000` (Next.js)
- Upgrade WebSocket connections to `wss://yourdomain.com` → `ws://localhost:8080`

### Production (Multiple Servers)

If deploying on separate servers:

**Web Server (.env)**:
```dotenv
NEXTAUTH_URL="https://yourdomain.com"
NEXT_APP_HOST="localhost"
NEXT_APP_PORT="3000"
WS_SERVER_HOST="ws-server.internal.domain"
WS_SERVER_PORT="8080"
```

**WebSocket Server (.env)**:
```dotenv
WS_SERVER_HOST="0.0.0.0"
WS_SERVER_PORT="8080"
NEXT_APP_HOST="web-server.internal.domain"
NEXT_APP_PORT="3000"
```

### Production with Managed WebSocket Service

If using a managed service (like Socket.io cloud):

```dotenv
WS_SERVER_URL="wss://managed-ws.service.io"
WS_USE_SECURE="true"
```

## Environment Variables Reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_APP_HOST` | localhost | Host for Next.js app (used by WS server) |
| `NEXT_APP_PORT` | 3000 | Port for Next.js app |
| `WS_SERVER_HOST` | localhost | Host for WebSocket server |
| `WS_SERVER_PORT` | 8080 | Port for WebSocket server |
| `WS_SERVER_URL` | (none) | Override for managed WebSocket service |
| `WS_USE_SECURE` | false | Use secure WebSocket (wss://) in production |
| `NODE_ENV` | development | Environment (development/production) |

## How It Works

1. **Gallery Component** (`app/components/Gallery.tsx`):
   - Fetches WebSocket URL from `/api/config` endpoint
   - Dynamically connects to correct WebSocket server
   - Works seamlessly in any environment

2. **WebSocket Server** (`scripts/ws-server.js`):
   - Reads port from `WS_SERVER_PORT` env variable
   - Forwards file upload notifications to Next.js API

3. **Ingest Watcher** (`scripts/ingest-watcher.js`):
   - Reads WebSocket host/port from env variables
   - Connects to WebSocket server for file broadcasts

## Nginx Reverse Proxy Configuration

For production with HTTPS and WebSocket:

```nginx
upstream nextjs {
    server localhost:3000;
}

upstream websocket {
    server localhost:8080;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Next.js
    location / {
        proxy_pass http://nextjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location ~ ^/ws {
        proxy_pass http://websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## Troubleshooting

### WebSocket Connection Failed
- Check that `WS_SERVER_PORT` matches where the server is running
- Verify firewall allows the WebSocket port
- Check browser console for connection errors
- Ensure WebSocket server is running: `npm run ws-server`

### Port Already in Use
- List process: `lsof -i :8080` (macOS/Linux) or `netstat -ano | findstr :8080` (Windows)
- Kill process: `lsof -ti:8080 | xargs kill -9` (macOS/Linux)
- Or change port in env variable

### Ingest Watcher Can't Connect
- Verify `WS_SERVER_HOST` and `WS_SERVER_PORT` are correct
- Check that WebSocket server is running and accessible
- Review WebSocket server logs for connection errors

## Docker/Kubernetes Deployment

For containerized deployments, use:

```dockerfile
# Start Next.js
CMD ["npm", "run", "start"]

# WebSocket runs as separate service/container
```

Set environment variables via:
- Docker: `ENV` in Dockerfile or `-e` flag
- Kubernetes: ConfigMaps and Secrets
- Docker Compose: `.env` file
