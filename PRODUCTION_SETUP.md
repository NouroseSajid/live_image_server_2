# Nourose Repository - Production Setup Guide

## Architecture Overview

```
repo.nourose.com (Cloudflare Tunnel)
        ↓
    Nginx proxy
        ↓
    Next.js (port 3000)
    WebSocket Server (port 8080)
```

## 1. Environment Variables

Create `.env.production` in your project root:

```dotenv
# ============================================
# NEXTAUTH CONFIGURATION
# ============================================
NEXTAUTH_SECRET="your-production-secret-here"
NEXTAUTH_URL="https://repo.nourose.com"

# ============================================
# GITHUB OAUTH
# ============================================
GITHUB_ID="your-github-prod-id"
GITHUB_SECRET="your-github-prod-secret"

# ============================================
# DATABASE (PostgreSQL recommended for production)
# ============================================
DATABASE_URL="postgresql://nourose_user:password@localhost:5432/nourose_repo"

# ============================================
# NEXTJS APP PORTS
# ============================================
NEXT_APP_HOST="localhost"
NEXT_APP_PORT="3000"

# ============================================
# WEBSOCKET SERVER
# ============================================
WS_SERVER_HOST="localhost"
WS_SERVER_PORT="8080"

# ============================================
# FILE PROCESSING
# ============================================
MAX_FILE_SIZE="1000"
IMAGE_QUALITY="80"
WEBP_QUALITY="75"
THUMB_WIDTH="300"
THUMB_HEIGHT="300"
ENABLE_VIDEO_PROCESSING="true"
VIDEO_MAX_BITRATE="3000k"

# ============================================
# SECURITY
# ============================================
BCRYPT_ROUNDS="14"
RATE_LIMIT_PER_MINUTE="50"

# ============================================
# CORS
# ============================================
CORS_ORIGINS="https://repo.nourose.com"

# ============================================
# INGEST WATCHER
# ============================================
INGEST_FOLDER_PATH="public/ingest"
FILE_STABLE_THRESHOLD="2000"
CONFIG_UPDATE_INTERVAL="10000"
DEFAULT_INGEST_FOLDER="LIVE"
```

## 2. Nginx Configuration

Save as `/etc/nginx/sites-available/repo.nourose.com`:

```nginx
upstream nextjs_repo {
    server localhost:3000;
    keepalive 64;
}

upstream websocket_repo {
    server localhost:8080;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name repo.nourose.com;

    # Redirect HTTP to HTTPS (Cloudflare handles HTTPS)
    # Since Cloudflare terminates SSL, we accept HTTP
    # But you can redirect if needed

    client_max_body_size 1000M;  # Match MAX_FILE_SIZE

    # Disable access logs for health checks
    map $request_uri $loggable {
        ~*^/health$ 0;
        default 1;
    }

    # Main application
    location / {
        proxy_pass http://nextjs_repo;
        proxy_http_version 1.1;

        # Headers for proper connection handling
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Dedicated WebSocket endpoint
    location ~ ^/api/ws {
        proxy_pass http://websocket_repo;
        proxy_http_version 1.1;

        # WebSocket headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Long timeout for WebSocket
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_connect_timeout 7d;

        # No buffering for WebSocket
        proxy_buffering off;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/repo.nourose.com /etc/nginx/sites-enabled/
sudo nginx -t  # Test config
sudo systemctl reload nginx
```

## 3. Systemd Service Files

### Next.js Service

Save as `/etc/systemd/system/nourose-repo.service`:

```ini
[Unit]
Description=Nourose Repository - Next.js App
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=nourose
WorkingDirectory=/home/nourose/live_image_server
EnvironmentFile=/home/nourose/live_image_server/.env.production

# Start the app
ExecStart=/usr/bin/npm run start

# Restart on failure
Restart=on-failure
RestartSec=10s

# Resource limits
LimitNOFILE=65535
LimitNPROC=4096

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=nourose-repo

[Install]
WantedBy=multi-user.target
```

### WebSocket Server Service

Save as `/etc/systemd/system/nourose-repo-ws.service`:

```ini
[Unit]
Description=Nourose Repository - WebSocket Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=nourose
WorkingDirectory=/home/nourose/live_image_server
EnvironmentFile=/home/nourose/live_image_server/.env.production

# Start the WebSocket server
ExecStart=/usr/bin/node scripts/ws-server.js

# Restart on failure
Restart=on-failure
RestartSec=10s

# Resource limits
LimitNOFILE=65535
LimitNPROC=4096

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=nourose-repo-ws

[Install]
WantedBy=multi-user.target
```

### Ingest Watcher Service (Optional)

Save as `/etc/systemd/system/nourose-repo-ingest.service`:

```ini
[Unit]
Description=Nourose Repository - Ingest Watcher
After=network-online.target nourose-repo-ws.service
Wants=network-online.target

[Service]
Type=simple
User=nourose
WorkingDirectory=/home/nourose/live_image_server
EnvironmentFile=/home/nourose/live_image_server/.env.production

# Start the ingest watcher
ExecStart=/usr/bin/node scripts/ingest-watcher.js

# Restart on failure
Restart=on-failure
RestartSec=10s

# Resource limits
LimitNOFILE=65535
LimitNPROC=4096

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=nourose-repo-ingest

[Install]
WantedBy=multi-user.target
```

## 4. Enable and Start Services

```bash
# Reload systemd daemon
sudo systemctl daemon-reload

# Enable services to start on boot
sudo systemctl enable nourose-repo.service
sudo systemctl enable nourose-repo-ws.service
sudo systemctl enable nourose-repo-ingest.service

# Start services
sudo systemctl start nourose-repo.service
sudo systemctl start nourose-repo-ws.service
sudo systemctl start nourose-repo-ingest.service

# Check status
sudo systemctl status nourose-repo.service
sudo systemctl status nourose-repo-ws.service
sudo systemctl status nourose-repo-ingest.service

# View logs
sudo journalctl -u nourose-repo -f
sudo journalctl -u nourose-repo-ws -f
sudo journalctl -u nourose-repo-ingest -f
```

## 5. Database Setup (PostgreSQL)

```bash
# Install PostgreSQL (if not already)
sudo apt-get install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE nourose_repo;
CREATE USER nourose_user WITH PASSWORD 'your-secure-password';
ALTER ROLE nourose_user SET client_encoding TO 'utf8';
ALTER ROLE nourose_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE nourose_user SET default_transaction_deferrable TO on;
ALTER ROLE nourose_user SET default_transaction_read_only TO off;
ALTER ROLE nourose_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE nourose_repo TO nourose_user;
\q
EOF

# Run migrations
cd /home/nourose/live_image_server
npm run prisma migrate deploy
```

## 6. Build and Deployment

```bash
# Install dependencies
cd /home/nourose/live_image_server
npm install

# Build Next.js
npm run build

# Verify services start
npm run start &
node scripts/ws-server.js &
node scripts/ingest-watcher.js &
```

## 7. Monitoring & Health Checks

```bash
# Check if services are running
sudo systemctl is-active nourose-repo.service
sudo systemctl is-active nourose-repo-ws.service

# Check if ports are listening
sudo ss -tlnp | grep -E '3000|8080'

# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Test WebSocket connection
curl http://localhost:3000/api/config

# View real-time logs
sudo journalctl -u nourose-repo -f
```

## 8. Cloudflare Tunnel Configuration

Your current config is correct:
```yaml
- hostname: repo.nourose.com
  service: http://localhost:80  # Or keep :3000 if Nginx isn't in front
```

Since you have Nginx, update to:
```yaml
- hostname: repo.nourose.com
  service: http://localhost:80  # Nginx listens on 80
```

## Troubleshooting

### WebSocket Connection Issues
1. Check WebSocket server is running: `sudo systemctl status nourose-repo-ws.service`
2. Verify port 8080: `sudo ss -tlnp | grep 8080`
3. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
4. Check app logs: `sudo journalctl -u nourose-repo -f`

### File Upload Issues
1. Check `MAX_FILE_SIZE` matches Nginx `client_max_body_size`
2. Verify `public/images` and `public/ingest` directories exist
3. Check permissions: `ls -la /home/nourose/live_image_server/public/`

### Database Connection
1. Verify PostgreSQL is running: `sudo systemctl status postgresql`
2. Test connection: `psql -U nourose_user -d nourose_repo -h localhost`
3. Check `.env.production` DATABASE_URL is correct

## Useful Commands

```bash
# Restart all services
sudo systemctl restart nourose-repo.service nourose-repo-ws.service

# View disk usage
du -sh /home/nourose/live_image_server/public/images

# Clear logs
sudo journalctl --vacuum=30d

# Backup database
pg_dump -U nourose_user nourose_repo > backup.sql

# Monitor resources
htop -p $(pgrep -f 'next-server|node')
```

---

**Ready to deploy?** Follow the steps above and let me know if you hit any issues!
