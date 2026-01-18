# Project Structure & Architecture

## Directory Overview

```
live_image_server/
├── app/
│   ├── admin/
│   │   ├── page.tsx              # Admin panel page
│   │   └── folders/
│   │       └── page.tsx          # Folder management page
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/route.ts      # NextAuth configuration
│   │   ├── folders/
│   │   │   ├── route.ts          # GET all, POST new folder
│   │   │   └── [id]/
│   │   │       ├── route.ts      # GET, PUT, DELETE folder
│   │   │       └── files/
│   │   │           └── route.ts  # GET files in folder
│   │   ├── images/
│   │   │   ├── upload/
│   │   │   │   └── route.ts      # POST image upload
│   │   │   ├── [id]/
│   │   │   │   └── route.ts      # DELETE image file
│   │   │   ├── live/
│   │   │   │   └── route.ts      # GET live images
│   │   │   └── repo/
│   │   │       └── route.ts      # GET repo images
│   │   ├── events/
│   │   │   └── route.ts          # SSE endpoint for real-time updates
│   │   └── ingest-config/
│   │       └── route.ts          # Manage ingest folder config
│   ├── components/
│   │   ├── AdminPanel.tsx        # Main admin panel component
│   │   ├── IngestFolderSelector.tsx  # Configure ingest target
│   │   ├── IngestMonitor.tsx     # Real-time ingest progress
│   │   ├── FolderManager.tsx     # (planned)
│   │   ├── ImageUploader.tsx     # (planned)
│   │   └── ... (other components)
│   ├── data/
│   │   └── siteLinks.ts
│   ├── lib/
│   │   └── imageData.ts
│   ├── providers/
│   │   └── AuthProvider.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── prisma/
│   ├── schema.prisma             # Database schema
│   ├── client.ts                 # Prisma client
│   ├── migrations/
│   │   └── 20251027104135_add_is_live_to_file/
│   │       └── migration.sql
│   └── dev.db                    # SQLite database (development)
│
├── public/
│   ├── ingest/                   # Drop files here for processing
│   ├── images/
│   │   └── {folderId}/
│   │       ├── original/         # Original files
│   │       ├── webp/             # WebP variants
│   │       ├── thumbs/           # Thumbnails
│   │       └── raw/              # RAW image files
│   ├── uploads/                  # Direct uploads from admin panel
│   │   └── {folderId}/
│   ├── favicon/
│   └── icons/
│
├── scripts/
│   ├── ingest-watcher.js         # Monitors and processes ingest folder
│   └── ws-server.js              # WebSocket server (port 8080)
│
├── middleware.ts                 # Next.js middleware
├── next.config.ts                # Next.js configuration
├── next-env.d.ts                 # Next.js types
├── tsconfig.json                 # TypeScript config
├── package.json                  # Dependencies & scripts
├── .env                          # Environment variables
├── .env.local                    # Local environment (secrets)
├── biome.json                    # Code formatting config
├── postcss.config.mjs            # PostCSS config
├── prisma.config.ts              # Prisma configuration
├── ARCHITECTURE.md               # Architecture documentation
├── COMPONENTS_SUMMARY.md         # Components overview
├── ADMIN_PANEL_SETUP.md          # Admin panel setup guide
├── INGEST_SYSTEM_SETUP.md        # Ingest system setup
├── QUICK_START.md                # Quick start guide
└── README.md                     # Project readme
```

## Data Flow

### Folder Management Flow
```
Admin Panel (UI)
    ↓
POST /api/folders          → Create new folder
PUT /api/folders/[id]      → Rename folder
DELETE /api/folders/[id]   → Delete folder
GET /api/folders           → List all folders
    ↓
Prisma (Database)
    ↓
SQLite (dev.db)
```

### Direct Upload Flow
```
Admin Panel (UI)
    ↓ (FormData)
POST /api/images/upload
    ↓
Save to: public/uploads/{folderId}/
Record in: Prisma File model
    ↓
Broadcast to Admin Panel
```

### Ingest Processing Flow
```
Files dropped in: public/ingest/
    ↓
ingest-watcher.js detects (chokidar)
    ↓
Process file (image/video/raw)
    ↓
Image: Create variants (WebP, thumbnail)
Video: Store original
RAW: Store original
    ↓
Save to: public/images/{folderId}/{type}/
Record in: Prisma database
    ↓
WebSocket → /api/events → SSE stream
    ↓
Admin Panel (IngestMonitor)
Real-time display of processed files
```

### Real-time Update Flow
```
ingest-watcher.js (processed file)
    ↓
WebSocket client connects to port 8080
    ↓
ws-server.js (port 8080)
    ↓
Forward to POST /api/events
    ↓
SSE stream sends to all clients
    ↓
Browser receives: new file data
    ↓
IngestMonitor component updates
```

## Database Schema

### Core Models

**Folder**
- `id` (CUID, primary)
- `name` (string, unique)
- `uniqueUrl` (string, unique, slug)
- `isPrivate` (boolean)
- `visible` (boolean)
- `passphrase` (string, optional)
- `inGridView` (boolean)
- `folderThumb` (string, optional)
- Relations: `files[]`, `accessLinks[]`, `downloadJobs[]`

**File**
- `id` (CUID, primary)
- `fileName` (string)
- `hash` (string, unique - MD5/SHA256)
- `width` (int, optional)
- `height` (int, optional)
- `rotation` (int - EXIF orientation)
- `fileSize` (BigInt - bytes)
- `fileType` (enum: image | video)
- `isLive` (boolean)
- `folderId` (foreign key)
- Relations: `folder`, `variants[]`

**Variant**
- `id` (CUID, primary)
- `name` (string - 'original', 'webp', 'thumbnail', etc.)
- `width` (int, optional)
- `height` (int, optional)
- `size` (BigInt - bytes)
- `path` (string - storage path)
- `codec` (string, optional - h264, hevc, etc.)
- `fileId` (foreign key)

**User**
- `id` (int, primary)
- `email` (string, unique)
- `name` (string, optional)
- `password` (string)
- Auth & timestamps

**AccessLink, DownloadJob, DownloadJobFile, Setting**
- For future: sharing, bulk downloads, config

## API Endpoints

### Folder Management
```
GET  /api/folders              - List all folders
POST /api/folders              - Create folder
GET  /api/folders/[id]         - Get folder details
PUT  /api/folders/[id]         - Update folder (rename, etc.)
DELETE /api/folders/[id]       - Delete folder
GET  /api/folders/[id]/files   - Get files in folder
```

### File Management
```
POST   /api/images/upload      - Upload image/video
DELETE /api/images/[id]        - Delete file
GET    /api/images/live        - Get live images
GET    /api/images/repo        - Get repo images
```

### Real-time Events
```
GET  /api/events               - SSE stream (connect)
POST /api/events               - Receive ingest updates
```

### Ingest Configuration
```
GET  /api/ingest-config        - Get current config
POST /api/ingest-config        - Set target folder
```

## File Storage Structure

### Ingest Folder
```
public/
└── ingest/
    └── (any file types)        → Watched by ingest-watcher
```

### Processed Images (Ingest)
```
public/
└── images/
    └── {folderId}/
        ├── original/
        │   └── filename.jpg     → Original file
        ├── webp/
        │   └── filename.webp    → WebP variant (85% quality)
        └── thumbs/
            └── filename_thumb.webp  → Thumbnail (300x300px)
```

### Direct Uploads
```
public/
└── uploads/
    └── {folderId}/
        └── {timestamp}-filename  → Direct upload files
```

### RAW Files
```
public/
└── images/
    └── {folderId}/
        └── raw/
            └── filename.cr2     → RAW files (preserved)
```

## Technology Stack

- **Frontend**: React 19, Next.js 15.5.6, Tailwind CSS 4
- **Backend**: Next.js API Routes, Node.js
- **Database**: Prisma ORM, SQLite (dev), MySQL (production)
- **Authentication**: NextAuth.js v4
- **Real-time**: WebSocket (ws library), Server-Sent Events (SSE)
- **File Processing**: Sharp (image processing), file-type (MIME detection)
- **File Watching**: Chokidar
- **Code Quality**: Biome (linting & formatting)
- **Build**: Turbopack, TypeScript

## Key Dependencies

```json
{
  "@prisma/client": "^6.17.1",
  "chokidar": "^4.0.3",          // File watching
  "sharp": "^0.34.4",            // Image processing
  "ws": "^8.16.0",               // WebSocket
  "file-type": "^18.7.0",        // MIME detection
  "next-auth": "^4.24.11",       // Auth
  "react-icons": "^4.11.0",      // UI icons
  "slugify": "^1.6.6"            // URL slug generation
}
```

## Configuration Files

- **`.env`** - Public env vars (DATABASE_URL, auth)
- **`.env.local`** - Secrets (GITHUB_SECRET, etc.)
- **`ingest-config.json`** - Generated, stores target folder ID
- **`tsconfig.json`** - TypeScript compilation
- **`next.config.ts`** - Next.js config
- **`biome.json`** - Code formatting rules
- **`prisma.config.ts`** - Prisma CLI config

## Running the System

```bash
# Terminal 1: Next.js development server
npm run dev

# Terminal 2: WebSocket server
npm run ws-server

# Terminal 3: Ingest watcher
npm run ingest
```

All three must be running for full functionality.

## Development vs Production

### Development
- SQLite local database (`prisma/dev.db`)
- Local file storage (`public/images/`, `public/uploads/`)
- WebSocket on port 8080
- Hot reload with Turbopack

### Production
- MySQL database (via CONNECTION_STRING)
- Cloud storage (S3, Azure Blob, etc.)
- WebSocket on internal port (behind reverse proxy)
- Built with `npm run build` and `npm start`

## Security Considerations

- NextAuth for user authentication
- X-Internal-Secret for WebSocket→SSE communication
- File type validation (MIME + magic bytes)
- Hash-based duplicate detection
- EXIF data handling (orientation only, strips other data)
- Database constraint on unique file hashes

## Performance Optimization

- Sequential file processing (prevent system overload)
- 1.5s write stability check (avoid partial upload processing)
- WebP compression (85% quality for variants)
- Thumbnail generation on-demand
- Streaming SSE for real-time updates
- Database indexing on frequently queried fields

---

This is a production-ready template that can be extended with additional features like bulk operations, advanced search, analytics, and cloud storage integration.
