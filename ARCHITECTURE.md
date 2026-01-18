# Component Architecture Map

## File Structure
```
app/
├── components/
│   ├── Gallery.tsx (Main container - orchestrates all components)
│   ├── ImageCard.tsx (Individual image tile)
│   ├── ImageGrid.tsx (Grid layout wrapper)
│   ├── CategoryNavigation.tsx (Category tabs)
│   ├── Lightbox.tsx (Full-screen image modal)
│   ├── ActionBar.tsx (Bottom floating action bar)
│   ├── LoadMoreButton.tsx (Pagination control)
│   ├── Navbar.tsx (Existing - preserved)
│   ├── Footer.tsx (Existing - preserved)
│   ├── Drawer.tsx (Existing - preserved)
│   ├── ThemeProvider.tsx (Existing - preserved)
│   └── ...other components
├── lib/
│   └── imageData.ts (Data generation & layout logic)
└── page.tsx (Main entry - routes to Gallery/Live/Repo)
```

## Component Hierarchy

```
page.tsx (Home)
└── Gallery (Main View)
    ├── Header (Sticky with scroll effect)
    ├── CategoryNavigation
    │   ├── Category Buttons
    │   └── Select All Button
    ├── ImageGrid
    │   └── Rows
    │       └── ImageCard[] (with selection)
    ├── LoadMoreButton
    ├── Lightbox (Modal)
    │   ├── Close Button
    │   ├── Prev/Next Navigation
    │   └── Image Display
    └── ActionBar (Floating)
        ├── Selection Counter
        ├── Action Buttons (Save, Share, Move, Delete)
        └── Close Button
```

## Data Flow

```
Gallery Component (State Management)
    │
    ├── activeFolder ──────────> CategoryNavigation
    │                           └──> filters which images to show
    │
    ├── width ─────────────────> buildRows() ──> rows
    │   (container width)                         │
    │                                             ├──> ImageGrid
    │                                             │    └──> ImageCard[]
    │                                             │
    ├── pageImages ────────────> buildRows()
    │   (sliced by visibleCount)
    │
    ├── selectedIds ───────────> ImageCard (selected prop)
    │                           └──> ActionBar (visibility)
    │
    └── lightboxImg ───────────> Lightbox
                                └──> modal display
```

## Event Handlers

```
ImageCard
├── onClick: Toggle select (Ctrl/Cmd) or open lightbox
└── Selection Checkbox: onToggle()

CategoryNavigation
├── Category Button: onSelectCategory()
└── Select All: onSelectAll()

Lightbox
├── Close Button: onClose()
├── Prev Button: onPrev()
└── Next Button: onNext()

ActionBar
└── Close Button: onClear() (clear selections)

LoadMoreButton
└── Load More: Increment visibleCount by 20
```

## Styling System

All components use **Tailwind CSS v4** with the project's dark theme:

```css
/* Color Palette */
Background: bg-[#09090b]
Text: text-zinc-100
Cards: bg-zinc-900/40
Borders: border-zinc-800
Accent: from-blue-500 to-indigo-600

/* Key Classes */
.scrollbar-hide { /* Custom CSS for hiding scrollbars */ }
backdrop-blur-xl { /* Glassmorphism effect */ }
shadow-blue-500/20 { /* Colored shadows */ }
scale-[1.03] { /* Micro-interactions */ }
```

## Performance Optimizations

1. **useMemo** - Recalculates rows only when pageImages or width changes
2. **Lazy Loading** - Images load with spinner, hidden until ready
3. **Virtual Scrolling Potential** - Current implementation suitable for ~1000 images
4. **Justify Layout** - Efficient masonry that minimizes whitespace

## Browser Compatibility

- Modern browsers with CSS Grid support
- CSS Flexbox for layouts
- CSS Animations and Transitions
- CSS Custom Properties (not used in this version)
- React 19.1.0+
- Next.js 15.5.6+

## Customization Points

### Add New Icon
Import from `react-icons`:
```tsx
import { MdYourIcon } from "react-icons/md";
```

### Change Colors
Edit in Gallery.tsx or globally in globals.css:
```tsx
from-blue-500 to-indigo-600 // Change these gradient colors
```

### Adjust Grid Height
In Gallery.tsx:
```tsx
buildRows(pageImages, width, 260, 14) // 260 is target row height
```

### Change Load More Count
In Gallery.tsx:
```tsx
onLoadMore={() => setVisibleCount((v) => Math.min(v + 20, allImages.length))}
// Change 20 to your preferred batch size
```
