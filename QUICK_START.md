# Quick Start: Full Ingest System

## What You Now Have

Your live image server now includes:
1. ✅ **Admin Panel** - Create/manage folders and upload images
2. ✅ **Ingest System** - Automatic file processing from a monitored folder
3. ✅ **Real-time Monitoring** - WebSocket + SSE for live updates
4. ✅ **Image Processing** - Auto-rotation, WebP variants, thumbnails
5. ✅ **Database Integration** - Prisma with SQLite (easily switchable to MySQL)

## Three-Terminal Setup

Open three terminals in the project directory:

### Terminal 1: Development Server
```bash
npm run dev
```
Your Next.js app will run at `http://localhost:3000`

### Terminal 2: WebSocket Server
```bash
npm run ws-server
```
WebSocket server runs on port 8080

### Terminal 3: Ingest Watcher
```bash
npm run ingest
```
Monitors `public/ingest/` folder for new files

**All three must be running for the complete system to work.**

## Using the System

### Step 1: Configure Target Folder
1. Open `http://localhost:3000/admin` (login required)
2. Scroll down to "Ingest Folder Configuration"
3. Select a folder from the dropdown
4. Click "Configure Ingest Folder"
5. You should see a green "Active" indicator

### Step 2: Start Ingest (if not already running)
- Terminal 2: `npm run ws-server`
- Terminal 3: `npm run ingest`

### Step 3: Drop Files
1. Create/use the `public/ingest/` folder
2. Drop image or video files there
3. Files will be detected automatically
4. Watch real-time progress in the "Ingest Monitor" section

### Step 4: View Results
- Files appear in your selected folder with variants
- Check database records with Prisma Studio: `npx prisma studio`

## What Happens to Each File

### Images
```
Original file (JPG, PNG, WebP, etc.)
    ↓
Auto-rotate based on EXIF
    ↓
Creates 3 variants:
  1. Original (in public/images/{folderId}/original/)
  2. WebP (85% quality, in public/images/{folderId}/webp/)
  3. Thumbnail (300×300px, in public/images/{folderId}/thumbs/)
    ↓
Records in database with metadata
    ↓
Broadcasts via WebSocket → SSE → Admin Panel
```

### Videos
```
Video file (MP4, MOV, WebM, etc.)
    ↓
Moves to public/images/{folderId}/original/
    ↓
Records metadata in database
    ↓
Broadcasts update to admin panel
```

### RAW Files
```
RAW file (CR2, ARW, NEF, etc.)
    ↓
Moves to public/images/{folderId}/raw/
    ↓
No processing (preservation of raw format)
```

## Admin Panel Features

### Create/Manage Folders
- **Left Panel**: List all folders
  - Click to select a folder
  - Edit (pencil icon) to rename
  - Delete (trash icon) to remove

### Upload Images Directly
- **Right Panel**: With folder selected
  - Drag images onto the upload area
  - Click to browse and select files
  - Files upload and appear in the list

### Ingest Configuration
- **Top Section**: Select target folder for ingest watcher
- **Status Indicator**: Shows if currently active/configured

### Ingest Monitor
- **Real-time Feed**: Last 10 processed files
- **Connection Status**: Shows if connected to WebSocket/SSE
- **File Details**: Shows filename, type, and timestamp

## File Types Supported

**Images:**
- JPEG, PNG, GIF, WebP, TIFF, BMP
- RAW: Sony (ARW), Canon (CR2/CR3), Nikon (NEF), Panasonic (RW2), Olympus (ORF), Fujifilm (RAF), Pentax (PEF), DNG

**Videos:**
- MP4, WebM, MOV, AVI, MKV, and most standard formats

## Troubleshooting

### "Ingest Monitor shows Disconnected"
- Make sure `npm run ws-server` is running
- Check that port 8080 isn't blocked
- Refresh the browser

### Files not appearing
- Verify `npm run ingest` is running
- Check that files are in `public/ingest/` (not a subfolder)
- Wait 1.5 seconds for files to stabilize (prevents partial uploads)
- Check browser console for errors

### WebSocket connection failed
- Ensure `npm run ws-server` is running
- Check if port 8080 is available: `netstat -ano | findstr :8080`
- Restart the ws-server

### Database errors
- Ensure `.env` has `DATABASE_URL` set
- Database should auto-initialize on first run
- If issues persist: `npx prisma migrate dev`

## Configuration Files

- **`.env`** - Main environment config (DATABASE_URL, secrets)
- **`ingest-config.json`** - Auto-generated when you select target folder in admin panel
  ```json
  { "folderId": "cmkjcap1j00003j2oaobyjl2h" }
  ```

## Next Steps

### To Enhance the System
1. **Add File Size Limits** - Set max upload/ingest size
2. **Batch Processing** - Process multiple files in parallel
3. **Archive Ingest Files** - Move processed ingest files elsewhere
4. **Cloud Storage** - Switch to S3 instead of local filesystem
5. **Video Encoding** - Generate multiple video qualities
6. **Image Compression** - Add more variant sizes

### To Deploy
1. Set `DATABASE_URL` to production MySQL instance
2. Change `X-Internal-Secret` in WebSocket server
3. Run WebSocket server as background service (PM2, systemd, etc.)
4. Run ingest watcher as background service
5. Set up proper logging and monitoring
6. Configure reverse proxy for WebSocket connections

## Key Files

- **Components**: `app/components/AdminPanel.tsx`, `IngestFolderSelector.tsx`, `IngestMonitor.tsx`
- **API Routes**: `app/api/folders/`, `app/api/images/`, `app/api/events/`, `app/api/ingest-config/`
- **Scripts**: `scripts/ingest-watcher.js`, `scripts/ws-server.js`
- **Database**: `prisma/schema.prisma`
- **Config**: `.env`, `ingest-config.json`, `package.json`

## Commands Summary

```bash
# Development
npm run dev              # Start Next.js server
npm run ws-server       # Start WebSocket server
npm run ingest          # Start ingest watcher

# Database
npx prisma studio      # Open Prisma Studio (GUI)
npx prisma migrate dev # Run migrations

# Utilities
npm run build           # Production build
npm run lint            # Lint code
npm run format          # Format code
```

---

**You're all set!** Start the three services and begin ingesting files. The system will automatically process images with variants and broadcast updates in real-time.
