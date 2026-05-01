# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Scholar PDF Downloader** — Chrome extension for batch downloading free PDFs from Google Scholar search results with automatic organization and metadata extraction.

**Key Docs:**
- `PRD.md` — Product requirements, features, success criteria
- `TECH_DESIGN.md` — Architecture, components, data flow, file structure

## Architecture Summary

**4-Layer Design:**

1. **Content Script** (`src/content.js`) — DOM parser on Scholar pages. Extracts paper metadata (title, authors, year, citations, PDF link, DOI, journal). Sends paper list to background worker.

2. **Background Service Worker** (`src/background.js`) — Main orchestrator. Manages download queue (2-3 concurrent), detects duplicates, handles rate limiting (429 detection + cooldown), updates stats, persists metadata.

3. **Popup UI** (`src/popup.html` + `src/popup.js`) — Real-time progress display. Shows found count, progress bar, current file, control buttons (Download All, Pause, Resume).

4. **Options Page** (`src/options.html` + `src/options.js`) — Settings (download folder, delay, concurrency) and stats dashboard.

**Storage:**
- `chrome.storage.local` — User prefs, stats, downloaded papers registry (for duplicate detection)
- File system — PDFs + per-query `metadata.json` in `Downloads/scholar/[query]/`

**Message Flow:**
Popup (getPapers) → Content (parse DOM) → Background (queue downloads) → Chrome Downloads API → Popup (progress updates)

## File Structure

```
src/
├── manifest.json          # Extension config (permissions, scripts, icons)
├── background.js          # Background worker (download queue, storage, stats)
├── content.js             # DOM parser, paper extraction
├── popup.html / popup.js  # Progress UI & controls
├── options.html / options.js # Settings & stats
├── styles/
│   ├── popup.css
│   └── options.css
└── utils/
    ├── storage.js         # Chrome Storage API wrapper
    ├── queue.js           # DownloadQueue class (concurrency management)
    └── helpers.js         # Helpers (sanitizeFilename, isLoggedIn, etc)

icons/
├── icon16.png
├── icon48.png
└── icon128.png
```

## Key Implementation Details

**Content Script (DOM Selectors):**
- Results container: `.gs_ri` (each paper)
- Title: `.gs_rt a` → textContent
- Authors/Year/Journal: `.gs_a` → parse "Author1, Author2 - Journal, 2023"
- Citations: `.gs_fl > a[href*="cites="]` → extract number
- PDF link: `a[href$=".pdf"]`
- Scholar URL: `.gs_rt a` → href

**Download Queue:**
- Class with `concurrency`, `queue[]`, `active` count
- Methods: `add(paper)`, `process()`, `pause()`, `resume()`, `clear()`
- Processes sequentially from queue; respects concurrency limit

**Rate Limiting:**
- Detect HTTP 429 responses during download
- On 429: pause queue, set `pausedUntil` timestamp (10 min default)
- Auto-resume after cooldown; notify user

**Duplicate Detection:**
- Before download: check `chrome.storage.local.downloadedPapers[title]`
- Key: paper title (normalized)
- Value: {doi, downloadDate, filePath}

**Filename Sanitization:**
- Replace `[^a-zA-Z0-9_\-.\s]` with `_`
- Replace spaces with `_`
- Max 200 chars
- Format: `[Author]_[Title]_[Year].pdf` → `Einstein_Theory_of_Relativity_1905.pdf`

**metadata.json Structure (per query):**
```json
{
  "query": "machine learning",
  "downloadDate": "2026-05-01T10:30:00Z",
  "paperCount": 5,
  "papers": [
    {
      "title": "...",
      "authors": [],
      "year": 2023,
      "doi": "10.xxxx/xxxxx",
      "citations": 150,
      "journal": "Nature",
      "scholarUrl": "https://scholar.google.com/...",
      "downloadedFile": "einstein_theory_1905.pdf",
      "downloadDate": "2026-05-01T10:30:15Z",
      "fileSize": 1024000,
      "status": "success|skipped|error"
    }
  ]
}
```

## Development Setup

**Prerequisites:**
- Node.js 18+ (for any bundling if webpack added later)
- Chrome/Chromium browser (for testing)

**Installation:**
```bash
# No external dependencies required for initial MVP
# (Plain JS, Chrome APIs only)

# Load extension in Chrome:
# 1. Open chrome://extensions
# 2. Enable "Developer mode" (top right)
# 3. Click "Load unpacked"
# 4. Select this project root
```

## Testing Strategy

**Manual:**
- Load extension in Chrome
- Navigate to scholar.google.com
- Verify DOM parsing (open popup, check console for extracted papers)
- Test download queue (small batch: 3-5 papers, check concurrent behavior)
- Test duplicate detection (download same batch twice)
- Verify metadata.json created correctly
- Test rate limiting (check 429 handling)

**Automated (future):**
- Unit tests (Jest): DownloadQueue class, helpers (sanitizeFilename, parseAuthorsYear)
- Integration tests: Mock Chrome APIs, test background worker message handlers
- E2E tests: Use chrome-testing or Playwright with extension context

## Common Tasks

**Debug background worker:**
```
chrome://extensions/ → Scholar PDF Downloader → Service Worker → Inspect (opens DevTools)
```

**Check storage contents:**
```javascript
// In background DevTools console:
chrome.storage.local.get(null, console.log)
```

**Verify content script is running:**
Open DevTools (F12) on Scholar page → Console → logs from content.js should appear

**Simulate rate limiting:**
Mock 429 response in background worker; test queue pause/resume logic

## Key Considerations

1. **Chrome API Async**: All storage/downloads operations are async; use Promises/async-await consistently

2. **Message Passing**: Content script ↔ Background ↔ Popup use `chrome.runtime.onMessage` + `sendMessage`. Always include `type` field in messages for clarity

3. **Permissions**: Minimal set in manifest (activeTab, downloads, storage, scripting). Avoid requesting too broad permissions

4. **Scholar Terms**: Extension respects Scholar's implicit ToS (no hard API hammering, respect 429 responses, user owns responsibility for copyright)

5. **File Naming**: Sanitization is critical; invalid chars in filenames cause silent download failures

6. **Progress Updates**: Popup listens for background worker broadcast messages; ensure messages are sent at reasonable intervals (every 500ms) to avoid UI churn

7. **Error Recovery**: Failed downloads should retry once; if retry fails, mark as error and continue queue (don't block entire batch)

8. **Storage Limits**: Keep `downloadedPapers` registry capped at ~500 entries for memory efficiency; LRU eviction if needed

## References

- **Chrome Extension Docs**: https://developer.chrome.com/docs/extensions
- **Chrome Storage API**: https://developer.chrome.com/docs/extensions/reference/storage
- **Chrome Downloads API**: https://developer.chrome.com/docs/extensions/reference/downloads
