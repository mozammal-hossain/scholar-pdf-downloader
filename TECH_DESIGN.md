# Technical Design: Scholar PDF Downloader Extension

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│            Google Scholar Search Page                   │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴─────────────┐
        │                          │
   ┌────▼──────┐            ┌──────▼────┐
   │ Content   │            │ Popup UI  │
   │ Script    │            │ Component │
   └────┬──────┘            └──────┬────┘
        │                          │
        └────────────┬─────────────┘
                     │
        ┌────────────▼─────────────┐
        │  Background Service      │
        │  Worker (Main Logic)     │
        └────────────┬─────────────┘
                     │
        ┌────────────┴──────────────────────┐
        │                                   │
   ┌────▼──────────┐            ┌──────────▼──┐
   │ Chrome Storage│            │ Downloads   │
   │ API (Stats,   │            │ API (PDF    │
   │ Preferences)  │            │ Files)      │
   └───────────────┘            └─────────────┘
        │
   ┌────▼──────────┐
   │ Local Storage │
   │ (user prefs)  │
   └───────────────┘
```

---

## 2. Component Structure

### 2.1 Content Script (`src/content.js`)
**Purpose**: Parse Google Scholar page, extract paper data, send to background worker

**Responsibilities**:
- Wait for page load (use MutationObserver)
- Query DOM for search results `.gs_ri` (Scholar result items)
- Extract per paper:
  - Title (`.gs_rt a` text)
  - Authors (`.gs_a` first part before dash)
  - Year (`.gs_a` regex extract `(\d{4})`)
  - Citations count (`.gs_fl > a[href*="cites="]` text)
  - Free PDF link (`[href*=".pdf"]` in result)
  - DOI (extract from paper details or URL)
  - Journal/conference name (`.gs_a` second part)
  - Scholar page URL (`.gs_rt a href`)

**Output**: Send message to background worker with array:
```javascript
[
  {
    title: "String",
    authors: ["Author1", "Author2"],
    year: 2023,
    citations: 150,
    pdfUrl: "https://...",
    doi: "10.xxxx/xxxxx",
    journal: "Nature",
    scholarUrl: "https://scholar.google.com/...",
    scholarQuery: "machine learning"  // current search
  }
]
```

**API Communication**: 
- Listen: `chrome.runtime.onMessage.addListener()` for "getPapers"
- Send: `chrome.runtime.sendMessage(backgroundId, {type: "papersFound", data: papers})`

---

### 2.2 Background Service Worker (`src/background.js`)
**Purpose**: Orchestrate downloads, manage state, handle storage

**Responsibilities**:
- Listen for "papersFound" from content script
- Validate Scholar page (domain check)
- Check auth status (look for user avatar in page)
- Filter out duplicates (compare against localStorage downloaded list)
- Manage download queue (2-3 concurrent)
- Handle rate limiting (track 429 responses, pause + cooldown)
- Track statistics (increment counters)
- Coordinate with Downloads API

**Key Functions**:

```javascript
async function downloadBatch(papers, options) {
  // papers: array from content script
  // options: {downloadPath, delay, overwriteDuplicates}
  // returns: {downloaded: 5, skipped: 2, failed: 1}
}

async function downloadPdf(paper, options) {
  // Returns: {status, filename, size, error}
  // Handles: naming, folder creation, metadata save
}

function checkDuplicate(title, doi) {
  // Returns: true if already downloaded
}

function updateStats(type, value) {
  // Increment: totalDownloaded, totalSkipped, totalErrors, etc
}

async function handleRateLimit() {
  // Pause queue, show user notification, resume after cooldown
}
```

**Message Handlers**:
- `"papersFound"` → validate → queue downloads
- `"pauseDownload"` → pause queue
- `"resumeDownload"` → resume queue
- `"getStats"` → return current stats
- `"clearStats"` → reset counters

---

### 2.3 Popup UI (`src/popup.html` + `src/popup.js`)
**Purpose**: Real-time download progress, controls

**UI Layout**:
```
┌─────────────────────────────┐
│ Scholar PDF Downloader      │
├─────────────────────────────┤
│ Found: 24 free PDFs         │
│ Downloaded: 5/24            │
│                             │
│ [████░░░░░░░░░░░░░] 21%    │
│                             │
│ Current: Downloading...     │
│ einstein_physics_1915.pdf   │
│                             │
│ [Download All] [⚙ Options] │
│ [Pause] [Resume] [Cancel]  │
└─────────────────────────────┘
```

**UI Elements**:
- Found count: `<div id="foundCount">0</div>`
- Progress bar: `<progress id="progress" max="100" value="0"></progress>`
- Download status: `<div id="status">Ready</div>`
- Current file: `<div id="currentFile">-</div>`
- **Download All button**: `<button id="downloadAllBtn">Download All</button>` (always visible, enabled when papers found)
- **Pause button**: `<button id="pauseBtn">Pause</button>` (hidden until queue active)
- **Resume button**: `<button id="resumeBtn">Resume</button>` (hidden until paused)
- **Cancel button**: `<button id="cancelBtn">Cancel</button>` (always visible when queue active)
- **Options icon**: `<button id="optionsBtn">⚙ Options</button>` (link to options page)

**State-Driven Button Logic**:
```javascript
const buttonStates = {
  idle: { downloadAll: {visible: true, disabled: false}, pause: {visible: false}, resume: {visible: false}, cancel: {visible: false} },
  downloading: { downloadAll: {visible: true, disabled: true}, pause: {visible: true, disabled: false}, resume: {visible: false}, cancel: {visible: true, disabled: false} },
  paused: { downloadAll: {visible: true, disabled: true}, pause: {visible: false}, resume: {visible: true, disabled: false}, cancel: {visible: true, disabled: false} },
  complete: { downloadAll: {visible: true, disabled: false}, pause: {visible: false}, resume: {visible: false}, cancel: {visible: false} }
}

function updateButtonStates(state) {
  const buttons = buttonStates[state]
  
  const updateButton = (id, config) => {
    const btn = document.getElementById(id)
    btn.style.display = config.visible ? "block" : "none"
    if (config.disabled !== undefined) {
      btn.disabled = config.disabled
    }
  }
  
  updateButton("downloadAllBtn", buttons.downloadAll)
  updateButton("pauseBtn", buttons.pause)
  updateButton("resumeBtn", buttons.resume)
  updateButton("cancelBtn", buttons.cancel)
}
```

**Event Handlers**:
```javascript
// On popup open: request papers from active Scholar tab
window.addEventListener("load", () => {
  chrome.runtime.sendMessage({type: "getPapers"}, (response) => {
    if (response?.success) {
      updateButtonStates("downloading")
    }
  })
})

document.getElementById("downloadAllBtn").onclick = () => {
  chrome.runtime.sendMessage({type: "downloadAll"})
  updateButtonStates("downloading")
}

document.getElementById("pauseBtn").onclick = () => {
  chrome.runtime.sendMessage({type: "pauseDownload"})
  updateButtonStates("paused")
}

document.getElementById("resumeBtn").onclick = () => {
  chrome.runtime.sendMessage({type: "resumeDownload"})
  updateButtonStates("downloading")
}

document.getElementById("cancelBtn").onclick = () => {
  chrome.runtime.sendMessage({type: "cancelDownload"})
  updateButtonStates("idle")
}

document.getElementById("optionsBtn").onclick = () => {
  chrome.runtime.openOptionsPage()
}
```

**Critical Note**: Popup cannot directly send messages to content scripts. All communication routes through background.js:
- Popup sends "getPapers" → background.js
- Background receives "getPapers" → forwards to content.js via `chrome.tabs.sendMessage(tabId, ...)`
- Content extracts papers → sends "papersFound" to background.js
- Background broadcasts progress to popup via `chrome.runtime.sendMessage()`

**Logic**:
- On popup open: trigger content script to parse page + display copyright warning (if first install)
- Listen to background worker progress updates (via `chrome.runtime.onMessage`)
- Update UI every 500ms with current state
- Handle button clicks → send messages to background

**Data Flow**:
```
popup.js (onOpen)
  → showCopyrightWarning() if first install
  → sendMessage({type: "getPapers"}) to background.js
  → background.js receives "getPapers"
  → background.js uses chrome.tabs.sendMessage() to content.js on active tab
  → content.js extracts papers from DOM
  → content.js sends {type: "papersFound", data: papers} to background.js
  → background.js validates, filters duplicates, queues downloads
  → background.js starts queue processing (2-3 concurrent)
  → background.js broadcasts {type: "downloadProgress"} to popup.js
  → popup.js listens for progress messages, updates UI + button states real-time
```

---

### 2.4 Copyright Warning Modal (`src/copyright-warning.js`)
**Purpose**: Display legal disclaimer on first install

**Trigger**: 
- Check `chrome.storage.local.copyrightWarningShown` on first popup open
- If false: show modal overlay blocking further action
- On "I Understand" click: set flag + close modal + proceed to downloads

**UI**:
```html
<div id="copyrightModal" class="modal">
  <h2>Copyright & Terms of Service</h2>
  <p>You are responsible for ensuring downloaded papers comply with copyright law and Google Scholar's Terms of Service.</p>
  <p>Extension respects Scholar's implicit rate limiting. Violations of ToS are user responsibility.</p>
  <button id="acceptBtn">I Understand</button>
</div>
```

**Logic**:
```javascript
// In popup.js onload:
chrome.storage.local.get(["copyrightWarningShown"], (result) => {
  if (!result.copyrightWarningShown) {
    showCopyrightModal()
    document.getElementById("acceptBtn").onclick = () => {
      chrome.storage.local.set({copyrightWarningShown: true})
      closeCopyrightModal()
      enableDownloadUI()
    }
  }
})
```

---

### 2.5 Options Page (`src/options.html` + `src/options.js`)
**Purpose**: Settings, stats dashboard

**Sections**:
1. **Download Settings**:
   - Custom download folder (input + file picker)
   - Auto-organize by query (checkbox)
   - Download delay (slider: 0-5000ms)
   - Concurrent downloads (dropdown: 1-5)

2. **Rate Limiting**:
   - Cooldown duration (input: minutes)
   - Auto-pause on 429 (checkbox)

3. **Statistics**:
   - Total searches
   - Total PDFs found
   - Total PDFs downloaded
   - Total PDFs skipped
   - Total data (MB)
   - Clear stats button

4. **About**:
   - Version
   - GitHub link

---

## 3. Data Storage

### 3.1 Chrome Storage API
**Purpose**: Persist user preferences & stats across sessions

**Structure**:
```javascript
{
  // User Preferences
  preferences: {
    downloadPath: "/Users/user/Downloads",
    autoOrganize: true,
    downloadDelay: 1000,  // ms
    concurrentDownloads: 2,
    overwriteDuplicates: false,
    rateLimitCooldown: 10  // minutes
  },

  // Download Statistics
  stats: {
    totalSearches: 15,
    totalPdfsFound: 342,
    totalPdfsDownloaded: 287,
    totalPdfsSkipped: 45,      // duplicates
    totalPdfsFailed: 10,       // errors
    totalDataDownloaded: 1250, // MB
    lastReset: "2026-05-01",
    sessionStart: "2026-05-01T10:30:00Z"
  },

  // Downloaded Papers Registry (for duplicate detection)
  downloadedPapers: {
    "Einstein Theory of Relativity 1905": {
      doi: "10.xxxx/xxxxx",
      downloadDate: "2026-05-01",
      filePath: "machine_learning/einstein_relativity_1905.pdf"
    }
  },

  // Rate Limiting State
  rateLimit: {
    isPaused: false,
    pausedUntil: null,  // timestamp
    lastFailTime: null
  }
}
```

**API Usage**:
```javascript
// Save
chrome.storage.local.set({preferences: {...}})

// Read
chrome.storage.local.get(["preferences", "stats"], (result) => {
  console.log(result.preferences)
})

// Clear
chrome.storage.local.remove(["stats"])
```

### 3.2 File System (Downloads API)
**Purpose**: Store PDF files + metadata

**Folder Structure**:
```
Downloads/
└── scholar/
    ├── machine_learning/
    │   ├── einstein_theory_1905.pdf
    │   ├── hawking_black_holes_1974.pdf
    │   └── metadata.json
    ├── neural_networks/
    │   ├── lecun_deep_learning_2015.pdf
    │   └── metadata.json
    └── config.json  (version, last sync)
```

**metadata.json Format**:
```json
{
  "query": "machine learning",
  "downloadDate": "2026-05-01T10:30:00Z",
  "paperCount": 2,
  "papers": [
    {
      "title": "A Theory of Relativity",
      "authors": ["Albert Einstein"],
      "year": 1905,
      "doi": "10.xxxx/xxxxx",
      "citations": 50000,
      "journal": "Annalen der Physik",
      "scholarUrl": "https://scholar.google.com/...",
      "downloadedFile": "einstein_theory_1905.pdf",
      "downloadDate": "2026-05-01T10:30:15Z",
      "fileSize": 1024000,
      "status": "success"
    }
  ]
}
```

**API Usage**:
```javascript
// Download file
chrome.downloads.download({
  url: pdfUrl,
  filename: "scholar/machine_learning/einstein_theory_1905.pdf",
  saveAs: false
})

// Search downloads
chrome.downloads.search({
  filenameRegex: ".*scholar.*"
}, (results) => {
  console.log(results)  // Array of download items
})
```

---

## 4. API Calls & Data Extraction

### 4.1 Google Scholar Page Scraping
**Method**: DOM parsing (no external API, Scholar ToS compliant)

**Filter Support**:
- Extension respects active Scholar filters (date range, subject area, article type, author) *passively*
- No active filter detection needed: DOM already reflects user's filter selections
- Papers visible on page = papers matching current filters
- Extension downloads only visible `.gs_ri` elements (honors page filters automatically)

**DOM Selectors**:
```javascript
const results = document.querySelectorAll('.gs_ri')  // Each paper

results.forEach(result => {
  const title = result.querySelector('.gs_rt a')?.textContent
  const authorsYear = result.querySelector('.gs_a')?.textContent
  // Parse: "Author1, Author2 - Journal, 2023"
  
  const citations = result.querySelector('.gs_fl > a[href*="cites="]')?.textContent
  // Extract: "Cited by 150"
  
  const pdfLink = result.querySelector('a[href$=".pdf"]')?.href
  
  const scholarUrl = result.querySelector('.gs_rt a')?.href
})
```

**Rate Limiting Detection**:
```javascript
// Monitor fetch/XHR responses for 429 status
// Store last attempt timestamp
// If 429 detected, pause queue + notify user
```

### 4.2 PDF Download
**Method**: Chrome Downloads API

**Flow**:
```javascript
async function downloadPdf(paper, targetFolder) {
  // 1. Sanitize filename
  const filename = sanitizeFilename(
    `${paper.authors[0]}_${paper.title}_${paper.year}.pdf`
  )
  
  // 2. Create folder if not exist
  // (Note: Chrome can't create folders; use path with slashes)
  const fullPath = `scholar/${targetFolder}/${filename}`
  
  // 3. Start download
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url: paper.pdfUrl,
        filename: fullPath,
        saveAs: false
      },
      (downloadId) => {
        // 4. Monitor download completion
        chrome.downloads.onChanged.addListener((delta) => {
          if (delta.id === downloadId && delta.state?.current === "complete") {
            // 5. Save metadata
            saveMetadata(paper, filename)
            resolve({status: "success", filename})
          }
        })
      }
    )
  })
}

function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9_\-.\s]/g, '_')  // Replace invalid chars
    .replace(/\s+/g, '_')                  // Replace spaces
    .substring(0, 200)                     // Max length
}
```

### 4.3 Authentication Check
**Method**: Check for Scholar user profile indicator

```javascript
function isUserLoggedIn() {
  // Look for user avatar or profile menu in Scholar page header
  const userProfile = document.querySelector('[aria-label*="User profile"]')
  return !!userProfile
}

function checkAuthStatus() {
  if (!isUserLoggedIn()) {
    sendNotification("Please log into Google Scholar first")
    return false
  }
  return true
}
```

---

## 5. Download Queue & Concurrency Management

### 5.1 Queue System
```javascript
class DownloadQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency
    this.queue = []
    this.active = 0
    this.paused = false
  }

  async add(paper) {
    this.queue.push(paper)
    this.process()
  }

  async process() {
    if (this.paused || this.active >= this.concurrency) return

    if (this.queue.length === 0) {
      notifyCompletion()
      return
    }

    this.active++
    const paper = this.queue.shift()

    try {
      const result = await downloadPdf(paper)
      updateProgress(result)
    } catch (err) {
      handleDownloadError(paper, err)
    }

    this.active--
    this.process()
  }

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
    this.process()
  }

  clear() {
    this.queue = []
  }
}
```

### 5.2 Rate Limiting Logic
```javascript
const rateLimitState = {
  attemptCount: 0,
  windowStart: Date.now(),
  paused: false,
  pausedUntil: null
}

async function handleDownloadWithRateLimit(paper) {
  // Check if in cooldown
  if (rateLimitState.pausedUntil && Date.now() < rateLimitState.pausedUntil) {
    return "queued"
  }

  try {
    const result = await downloadPdf(paper)
    rateLimitState.attemptCount = 0  // Reset on success
    return result
  } catch (err) {
    if (err.status === 429) {
      // Pause queue for cooldown period
      rateLimitState.pausedUntil = Date.now() + (10 * 60 * 1000)  // 10 min
      queue.pause()
      notifyUser("Rate limited. Resuming in 10 minutes...")
      setTimeout(() => queue.resume(), 10 * 60 * 1000)
      return "rate_limited"
    }
    throw err
  }
}
```

### 5.3 Retry Logic (Per-Paper, Up to 2x)
**Strategy**: Each paper retry up to 2 times on network/timeout errors (not on 429 or auth failures)

**Retry Conditions**:
- ✅ Network timeout (>30s with no response)
- ✅ 5xx errors (500, 502, 503, 504)
- ❌ 429 (handled by rate limit pause, not individual retry)
- ❌ 404 (PDF doesn't exist, no retry)
- ❌ 403/401 (auth issue, no retry)

**Retry Logic**:
```javascript
async function downloadPdfWithRetry(paper, maxRetries = 2) {
  let lastError
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await downloadPdf(paper)
      return {status: "success", ...result}
    } catch (err) {
      lastError = err
      
      // Check if retryable
      const isRetryable = (
        err.isTimeout || 
        (err.status >= 500 && err.status < 600)
      )
      
      if (!isRetryable || attempt > maxRetries) {
        return {
          status: "failed",
          error: lastError.message,
          attempts: attempt
        }
      }
      
      // Exponential backoff: 2s, 4s (before 3rd attempt)
      const backoffMs = Math.pow(2, attempt) * 1000
      await new Promise(resolve => setTimeout(resolve, backoffMs))
    }
  }
  
  return {status: "failed", error: lastError.message, attempts: maxRetries + 1}
}
```

**Integration with Queue**:
```javascript
// In DownloadQueue.process():
async process() {
  if (this.paused || this.active >= this.concurrency) return
  
  if (this.queue.length === 0) {
    notifyCompletion()
    return
  }
  
  this.active++
  const paper = this.queue.shift()
  
  try {
    // Use retry-enabled download instead of direct downloadPdf
    const result = await downloadPdfWithRetry(paper, 2)
    
    if (result.status === "success") {
      updateStats("downloaded")
    } else {
      updateStats("failed")
      notifyUser(`Failed to download ${paper.title} after ${result.attempts} attempts`)
    }
  } catch (err) {
    updateStats("failed")
  }
  
  this.active--
  this.process()
}
```

---

## 6. Message Flow Diagram

```
┌─────────────┐
│ User clicks │
│"Download   │
│ All PDFs"   │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────┐
│ popup.js sends {type:            │
│ "getPapers"} to background.js    │
│ via chrome.runtime.sendMessage() │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ background.js receives           │
│ "getPapers" message              │
│ Gets active tab ID               │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ background.js sends message to   │
│ content.js via chrome.tabs.      │
│ sendMessage(tabId, {type:        │
│ "getPapers"})                    │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ content.js receives "getPapers"  │
│ Parses DOM, extracts paper       │
│ metadata, builds papers array    │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ content.js sends {type:          │
│ "papersFound", data: papers}     │
│ back to background.js            │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ background.js receives           │
│ "papersFound" message            │
│ - Validates auth                 │
│ - Checks duplicates              │
│ - Queues downloads               │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ background.js starts queue       │
│ processing (2-3 concurrent)      │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Per paper:                       │
│ - Download PDF (Chrome API)      │
│ - Sanitize filename              │
│ - Save to folder                 │
│ - Extract metadata               │
│ - Append to metadata.json        │
│ - Update stats                   │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ background.js broadcasts {type:  │
│ "downloadProgress", data:        │
│ {downloaded, current, total}}    │
│ to popup.js via chrome.runtime.  │
│ sendMessage()                    │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ popup.js listens for progress    │
│ messages via chrome.runtime.     │
│ onMessage.addListener()          │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ popup.js updates UI in           │
│ real-time (progress bar,         │
│ file count, current file,        │
│ button states)                   │
└──────────────────────────────────┘
```

---

## 7. Error Handling Strategy

| Error | Detection | Recovery |
|-------|-----------|----------|
| 429 Rate Limited | HTTP status in download response | Pause queue (10 min cooldown), auto-resume |
| Network Timeout | Fetch takes >30s | Retry up to 2x per paper; exponential backoff (2s, 4s) |
| 5xx Server Error | HTTP 500-504 | Retry up to 2x per paper; exponential backoff (2s, 4s) |
| 404 PDF Not Found | Download fails, 0-byte file | Mark as failed (no retry), continue queue |
| 403/401 Auth Error | Access denied to PDF | Mark as failed (no retry), notify user |
| Duplicate File | Title/DOI match in downloadedPapers | Skip, increment skipped counter |
| Auth Required | isUserLoggedIn() returns false | Show notification, stop process |
| Folder Creation Failed | Chrome API error | Save to root Downloads, log error |
| Invalid Title Chars | Filename contains `<>:"|?*` | Sanitize: replace with `_` |

---

## 8. Tech Stack & Multi-Browser Support

### 8.1 Core Tech Stack

| Layer | Technology |
|-------|-----------|
| **UI** | HTML5 + CSS3 + Vanilla JS |
| **State Management** | Chrome Storage API + In-memory queue |
| **Download Manager** | Chrome Downloads API |
| **Page Parsing** | DOM API + regex |
| **Build** | Webpack (optional) or plain JS |
| **Testing** | Jest (unit) + Chrome Extension Testing (e2e) |

### 8.2 Multi-Browser Support (MVP)

**Manifest Strategy**: Separate manifests for Chrome (v3) and Firefox (v2)

**Chrome (Manifest v3)**:
```json
{
  "manifest_version": 3,
  "name": "Scholar PDF Downloader",
  "permissions": ["activeTab", "scripting", "downloads", "storage"],
  "host_permissions": ["https://scholar.google.com/*"],
  "background": {"service_worker": "src/background.js"}
}
```

**Firefox (Manifest v2)**:
```json
{
  "manifest_version": 2,
  "name": "Scholar PDF Downloader",
  "permissions": ["activeTab", "downloads", "storage", "https://scholar.google.com/*"],
  "background": {"scripts": ["src/background.js"]}
}
```

**API Compatibility**:

| Feature | Chrome | Firefox | Polyfill |
|---|---|---|---|
| `chrome.downloads` | ✅ | `browser.downloads` | Use `window.chrome || window.browser` |
| `chrome.storage` | ✅ | `browser.storage` | Use `window.chrome || window.browser` |
| `chrome.runtime` | ✅ | `browser.runtime` | Use `window.chrome || window.browser` |
| Service Workers | v3 only | N/A | Use content scripts for Firefox |

**Compatibility Shim** (`src/utils/compat.js`):
```javascript
// Normalize API access across Chrome/Firefox
const API = {
  downloads: chrome?.downloads || browser?.downloads,
  storage: chrome?.storage || browser?.storage,
  runtime: chrome?.runtime || browser?.runtime
}

export default API
```

**Safari Support**: Deferred to V2+ (requires iOS app wrapper + different manifest)

**Build Process**:
- Single JS/HTML source code (no duplication)
- Generate Chrome and Firefox manifests at build time
- Test both builds before release

---

## 9. File Structure

```
google-chrome-extension/
├── manifest.json              # Chrome manifest (v3)
├── manifest.firefox.json      # Firefox manifest (v2) - build-generated
├── src/
│   ├── background.js          # Background worker (main logic)
│   ├── content.js             # Content script (page parser)
│   ├── popup.html             # Popup UI
│   ├── popup.js               # Popup logic + copyright warning trigger
│   ├── copyright-warning.js   # Copyright modal component
│   ├── options.html           # Settings page
│   ├── options.js             # Settings logic
│   ├── styles/
│   │   ├── popup.css
│   │   ├── options.css
│   │   └── copyright-warning.css
│   └── utils/
│       ├── compat.js          # Chrome/Firefox API compatibility shim
│       ├── storage.js         # Chrome Storage wrapper
│       ├── queue.js           # Download queue class (with retry)
│       └── helpers.js         # Utilities (sanitize, etc)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── PRD.md                     # Product spec (reference)
└── TECH_DESIGN.md             # This file
```

---

## 10. Performance Considerations

1. **Lazy Load**: Only inject content script on Scholar domain
2. **Debounce**: Delay metadata.json writes (batch updates)
3. **Memory**: Clear queue after batch completes
4. **Concurrency**: 2-3 downloads max (avoid Scholar blocking)
5. **Storage**: Limit downloadedPapers registry to last 500 papers (for memory)

---

## 11. Security Considerations

1. **CSP**: Restrict inline scripts, no eval()
2. **XSS**: Sanitize user input (download path, filenames)
3. **CORS**: Chrome extension bypasses CORS for Scholar
4. **Storage**: Use `chrome.storage.local` (encrypted by browser)
5. **Permissions**: Request minimal (activeTab, downloads, storage)

