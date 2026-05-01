# Scholar PDF Downloader

Chrome extension for batch downloading free PDFs from Google Scholar search results with automatic organization and metadata extraction.

## Installation

### Step 1: Download / Clone Repository

```bash
# Clone from GitHub
git clone https://github.com/mozammal-hossain/scholar-pdf-downloader.git
cd scholar-pdf-downloader

# Or download ZIP and extract
```

### Step 2: Load in Chrome

1. Open **`chrome://extensions`** in browser address bar
2. Enable **"Developer mode"** toggle (top right corner)
3. Click **"Load unpacked"** button
4. Select the `scholar-pdf-downloader` folder
5. Extension loads and icon appears in toolbar

Extension is now active and ready to use.

## How to Use

### Basic Usage (3 Steps)

1. **Go to Google Scholar**
   - Navigate to https://scholar.google.com
   - Search for papers (e.g., "artificial intelligence", "machine learning")
   - Wait for results page to load

2. **Open Extension Popup**
   - Click Scholar PDF Downloader icon in Chrome toolbar
   - Popup shows: `Found: [number] papers`
   - If 0 papers found, scroll Scholar page or refresh

3. **Download All Papers**
   - Click **"Download All"** button
   - Watch progress bar fill in real-time
   - Downloads start automatically to `Downloads/scholar/[query]/` folder
   - Each PDF organized by search query

### During Download

**Popup shows:**
- **Found**: Total papers detected with PDF links
- **Progress**: Current download count (e.g., 3/10)
- **Current file**: Paper title being downloaded
- **Status**: Success, pause, or error messages

**Controls:**
- **Pause**: Stop downloads mid-batch, resume later
- **Resume**: Continue paused downloads
- **Clear**: Reset found papers count

### After Download Completes

**Files saved:**
```
Downloads/
└── scholar/
    └── artificial intelligence/
        ├── Author1_Title_2023.pdf
        ├── Author2_Paper_2024.pdf
        └── metadata.json    ← full paper details
```

**metadata.json** contains:
- Paper title, authors, year, journal
- Citation count, DOI, Scholar URL
- Download status (success/skipped/error)
- Timestamps

### Settings & Stats

1. Click **"Settings"** in popup → Opens Options page
2. Configure:
   - **Concurrent Downloads**: How many PDFs download at once (1-10, default 2)
   - **Delay Between**: Wait time between downloads in ms (default 500)
   - **Rate Limit Pause**: Minutes to wait if site blocks requests (default 10)
3. Click **"View Stats"** to see:
   - Total downloaded
   - Total failed
   - Total skipped (duplicates)

## Features

- **Batch Download**: Extract and download multiple papers at once
- **Duplicate Detection**: Automatically skip papers already downloaded
- **Concurrency Control**: Configurable parallel downloads (default: 2)
- **Rate Limiting**: Auto-pause on HTTP 429 with configurable cooldown
- **Metadata Extraction**: Saves `metadata.json` per query with:
  - Paper title, authors, year, journal
  - Citation count, DOI, Scholar URL
  - Download status and timestamps
- **Progress Tracking**: Real-time UI updates during downloads
- **Statistics Dashboard**: Track total downloaded, skipped, failed papers

## Configuration

Open **Settings** (via popup → Settings button or Options page):

- **Concurrent Downloads**: Number of parallel downloads (1-10, default: 2)
- **Delay Between Downloads**: Wait time in ms (default: 500ms)
- **Rate Limit Cooldown**: Minutes to pause on 429 response (default: 10)

## File Structure

```
src/
├── manifest.json              # Extension config
├── background.js              # Main orchestrator, download queue
├── content.js                 # DOM parser for Scholar pages
├── popup.html / popup.js       # Progress UI
├── options.html / options.js   # Settings & stats dashboard
└── utils/
    ├── queue.js               # Download concurrency manager
    ├── storage.js             # Chrome Storage API wrapper
    └── helpers.js             # Utility functions
styles/
├── popup.css                  # Popup styling
└── options.css                # Options page styling
icons/
├── icon16.png                 # Extension icon (16x16)
├── icon48.png                 # Extension icon (48x48)
└── icon128.png                # Extension icon (128x128)
```

## Data Storage

**Chrome Storage** (`chrome.storage.local`):
- User settings (concurrency, delay, cooldown)
- Download statistics (total, skipped, failed)
- Downloaded papers registry (for duplicate detection)
- Per-query metadata

**File System** (`Downloads/scholar/[query]/`):
- PDF files
- `metadata.json` with full paper details

## Message Flow

```
Popup (User clicks "Download All")
  ↓
sendMessage: getPapers → Content Script
  ↓
Content Script: Parse DOM, extract papers
  ↓
sendMessage: startDownloads → Background Worker
  ↓
Background: Check duplicates, manage queue, download PDFs
  ↓
sendMessage: downloadProgress → Popup (real-time updates)
  ↓
Popup: Show progress bar, current file, stats
```

## Key Implementation Notes

### Content Script (DOM Selectors)
- Results: `.gs_ri` (each paper result)
- Title: `.gs_rt a` → textContent
- Authors/Year: `.gs_a` → parsed from text
- Citations: `.gs_fl > a[href*="cites="]` → extract number
- PDF link: `a[href$=".pdf"]`

### Queue Management
- Respects concurrency limit (default: 2 simultaneous)
- Processes sequentially from queue
- Auto-pauses on rate limiting (HTTP 429)
- Resumes after configured cooldown

### Duplicate Detection
- Key: normalized paper title
- Value: DOI, download date, file path
- Stored in `chrome.storage.local.downloadedPapers`

### Metadata Structure
```json
{
  "query": "machine learning",
  "downloadDate": "2026-05-01T10:30:00Z",
  "paperCount": 5,
  "papers": [
    {
      "title": "...",
      "authors": ["Author1", "Author2"],
      "year": 2023,
      "doi": "10.xxxx/xxxxx",
      "citations": 150,
      "journal": "Nature",
      "scholarUrl": "https://scholar.google.com/...",
      "downloadedFile": "Author1_Title_2023.pdf",
      "status": "success|skipped|error"
    }
  ]
}
```

## Troubleshooting

### No papers found?
- Ensure you're on a Google Scholar search results page
- Open DevTools (F12) → Console on Scholar tab
- Check for content script logs (should see: "Scholar PDF Downloader content script loaded")

### Downloads not starting?
- Check Background Service Worker logs: chrome://extensions → "Inspect" under Scholar PDF Downloader
- Verify Chrome storage: Run `chrome.storage.local.get(null, console.log)` in background DevTools

### Rate limited (HTTP 429)?
- Extension automatically pauses for 10 minutes (configurable)
- Check status message in popup for pause timer
- Reduce concurrent downloads in Settings to 1-2

### File naming issues?
- Invalid characters replaced with `_`
- Spaces converted to `_`
- Max 200 characters
- Check `metadata.json` for actual saved filename

## Development

### Testing Locally
1. Load extension in Chrome (see Quick Start)
2. Navigate to Google Scholar search
3. Open extension popup (toolbar icon)
4. Test "Download All", "Pause", "Resume" flows
5. Check Options page for settings and stats
6. Verify metadata.json in Downloads folder

### Debugging
- **Content Script**: DevTools (F12) on Scholar page
- **Background Worker**: chrome://extensions → Inspect
- **Storage**: `chrome.storage.local.get(null, console.log)` in background console
- **Downloads**: Check Chrome downloads history (Ctrl+J / Cmd+Shift+J)

## Future Enhancements

- [ ] Selectable batch downloading (checkboxes per paper)
- [ ] Export to BibTeX / CSL JSON
- [ ] Integration with Zotero / Mendeley
- [ ] Search filters (year, citation count, etc)
- [ ] Retry failed downloads with exponential backoff
- [ ] Storage quota management with LRU eviction
- [ ] Background sync for interrupted sessions
- [ ] Custom folder naming strategies

## License

Personal project. Scholar Terms: Extension respects Google Scholar's ToS (no aggressive API hitting, respects 429 responses, user owns copyright responsibility).

## Support

For issues, check:
1. Chrome console logs (F12 on Scholar page)
2. Background worker logs (chrome://extensions → Inspect)
3. Storage contents: `chrome.storage.local.get(null, console.log)`
