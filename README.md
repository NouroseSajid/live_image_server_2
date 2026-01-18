# Live Image Server

A complete, production-ready image and video management system with automatic ingest processing, real-time monitoring, and database integration.

## Features

### 🎯 Core Capabilities
- **Folder Management** - Create, rename, and organize image folders
- **Direct Upload** - Upload images/videos directly through admin panel
- **Automatic Ingest** - Monitor a folder and auto-process files
- **Image Processing** - Auto-rotation, WebP generation, thumbnail creation
- **Video Support** - Store and catalog video files
- **RAW File Support** - Preserve RAW image formats (CR2, ARW, NEF, etc.)
- **Real-time Monitoring** - WebSocket + SSE for live updates
- **Duplicate Detection** - MD5 hash-based file deduplication
- **Database Integration** - Prisma ORM with SQLite (MySQL ready)
- **Authentication** - NextAuth.js with GitHub provider

### 🏗️ Architecture
- **Frontend**: React 19 + Next.js 15.5.6 with Tailwind CSS
- **Backend**: Next.js API Routes + Node.js
- **Real-time**: WebSocket server + Server-Sent Events (SSE)
- **Database**: Prisma ORM with SQLite/MySQL
- **File Processing**: Sharp for images, Chokidar for file watching

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Port 3000, 8080 available

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database
```bash
# Set environment variable and run migrations
$env:DATABASE_URL="file:./prisma/dev.db"
npx prisma migrate dev
```

### 3. Start Three Services

**Terminal 1: Development Server**
```bash
npm run dev
```
Runs at http://localhost:3000

**Terminal 2: WebSocket Server**
```bash
npm run ws-server
```
WebSocket server on port 8080

**Terminal 3: Ingest Watcher**
```bash
npm run ingest
```
Monitors `public/ingest/` folder

### 4. Configure & Use
1. Go to http://localhost:3000/admin
2. Select a target folder for ingest
3. Drop files in `public/ingest/`
4. Watch real-time processing in admin panel

## Documentation

- **[QUICK_START.md](QUICK_START.md)** - Get up and running in minutes
- **[SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)** - Verification and troubleshooting
- **[INGEST_SYSTEM_SETUP.md](INGEST_SYSTEM_SETUP.md)** - Detailed ingest system guide
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Complete architecture & API docs
- **[WHATS_NEW.md](WHATS_NEW.md)** - Feature summary and overview
- **[ADMIN_PANEL_SETUP.md](ADMIN_PANEL_SETUP.md)** - Admin panel features

## File Storage

### Ingest Processing
Files dropped in `public/ingest/` are automatically processed:
- **Images**: Original + WebP variant (85% quality) + Thumbnail (300x300px)
- **Videos**: Original + metadata
- **RAW**: Preserved as-is in dedicated raw folder

### Storage Locations
```
public/
├── ingest/                    # Drop files here
├── images/{folderId}/
│   ├── original/             # Original files
│   ├── webp/                 # WebP variants
│   └── thumbs/               # Thumbnails
└── uploads/                  # Direct uploads
```

## Supported File Types

### Images
JPEG, PNG, GIF, WebP, TIFF, BMP, and RAW formats (Sony, Canon, Nikon, Panasonic, Olympus, Fujifilm, Pentax, DNG)

### Videos
MP4, WebM, MOV, AVI, MKV, and most common video formats

## API Endpoints

```
# Folder Management
GET    /api/folders                 # List all folders
POST   /api/folders                 # Create folder
GET    /api/folders/[id]            # Get folder
PUT    /api/folders/[id]            # Update folder
DELETE /api/folders/[id]            # Delete folder

# File Management
POST   /api/images/upload           # Upload file
DELETE /api/images/[id]             # Delete file
GET    /api/folders/[id]/files      # Get folder files

# Real-time Events
GET    /api/events                  # SSE stream (connect)
POST   /api/events                  # Receive updates

# Configuration
GET    /api/ingest-config           # Get config
POST   /api/ingest-config           # Set target folder
```

## Admin Panel

Access at `/admin` (requires authentication):

### Features
- **Folder Manager** (left panel)
  - View all folders
  - Click to select
  - Edit (rename)
  - Delete (with confirmation)

- **Image Upload** (right panel)
  - Drag-and-drop interface
  - Click to browse files
  - Real-time file list

- **Ingest Configuration**
  - Select target folder
  - Monitor configuration status
  - Shows active ingest target

- **Ingest Monitor**
  - Real-time processed files feed
  - Connection status
  - Last 10 files with timestamps

## Environment Variables

```env
DATABASE_URL="file:./prisma/dev.db"  # SQLite for development
NEXTAUTH_SECRET="your-secret"        # From .env.local
NEXTAUTH_URL="http://localhost:3000"
WHAT_AM_I="0"                        # 0=repo, 1=live
```

## Database

### Core Models
- **Folder** - Image collection containers
- **File** - Image/video metadata
- **Variant** - File variants (WebP, thumbnails, etc.)
- **User** - Authentication user
- **AccessLink** - Shareable links (future)
- **DownloadJob** - Bulk download (future)

View schema: `prisma/schema.prisma`
Open GUI: `npx prisma studio`

## Development

### Build for Production
```bash
npm run build
npm start
```

### Code Quality
```bash
npm run lint      # Biome linting
npm run format    # Code formatting
```

### Database Migrations
```bash
npx prisma migrate dev          # Create migration
npx prisma db push              # Push changes
npx prisma studio               # Open GUI
```

## Performance

- **Sequential Processing** - One file at a time (prevents overload)
- **Stability Check** - 1.5 second wait before processing (prevents partial uploads)
- **Image Variants** - Sharp-based processing with quality optimization
- **WebP Compression** - 85% quality for optimal size/quality balance
- **Thumbnail Generation** - 300x300px for quick previews

## Security

- NextAuth.js for user authentication
- X-Internal-Secret for internal API communication
- File type validation (MIME + magic bytes)
- Hash-based duplicate detection
- EXIF data handling (orientation only)
- Database constraints on unique values

## Production Deployment

For production deployment:

1. **Database**: Switch to MySQL
   ```env
   DATABASE_URL="mysql://user:password@host/database"
   ```

2. **Storage**: Use cloud storage (S3, Azure Blob)
   - Update file paths in API routes
   - Use signed URLs for access

3. **Services**: Run as background processes
   - Use PM2, systemd, or Docker
   - Set up proper monitoring

4. **Security**: 
   - Update secret keys
   - Enable HTTPS
   - Configure CORS properly
   - Add rate limiting

## Troubleshooting

### WebSocket Connection Failed
- Ensure `npm run ws-server` is running
- Check port 8080 isn't blocked
- Verify firewall settings

### Files Not Processing
- Verify all 3 services running
- Check `ingest-config.json` exists
- Ensure DATABASE_URL is set
- Check browser console for SSE errors

### Database Errors
- Run `npx prisma migrate dev`
- Delete `prisma/dev.db` and restart
- Verify DATABASE_URL in `.env`

See [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md) for more troubleshooting.

## Stack Highlights

- **Next.js 15.5.6** - React framework with Turbopack
- **Prisma** - Type-safe ORM
- **Tailwind CSS 4** - Utility-first styling with dark mode
- **Sharp** - High-performance image processing
- **Chokidar** - File system watcher
- **WebSocket (ws)** - Real-time communication
- **NextAuth.js** - Authentication
- **Biome** - Code quality and formatting

## License

MIT

## Contributing

Contributions are welcome! This is a template for building image management systems.

---

**Getting started?** Read [QUICK_START.md](QUICK_START.md) for a step-by-step guide.


## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
