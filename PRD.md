# Product Requirements Document: Scholar PDF Downloader Extension

## 1. Overview

**Product Name:** Scholar PDF Downloader  
**Type:** Browser Extension (Chrome, Firefox, Safari)  
**Core Purpose:** Batch download all free PDFs from Google Scholar search results with automatic organization and metadata extraction.

---

## 2. Problem Statement

Users spend excessive time manually downloading PDFs from Google Scholar search results. No automated tool exists to batch-download free papers with intelligent naming and folder organization.

---

## 3. Target User

Researchers, students, and academics who:
- Conduct literature reviews with multiple search queries
- Need to organize papers by subject/date
- Want automated metadata preservation (title, year, author)
- Have active Google Scholar accounts

---

## 4. Core Features

### 4.1 Authentication
- **Requirement**: User must be logged into Google Scholar account before using extension
- **Why**: Access free PDFs available to authenticated users only
- **Implementation**: Check authentication status on extension load; prompt login if needed

### 4.2 Batch PDF Download
- **Trigger**: One-click "Download All Free PDFs" button in popup
- **Scope**: Download all free PDFs visible on current Scholar search results page
- **Paper Selection**: Only papers with free PDF availability
- **Rate Limiting**: Handle Scholar's rate limiting (add delays between downloads, respect 429 responses)
- **Duplicates**: Skip papers already downloaded (check by title/DOI match)

### 4.3 Smart Naming & Organization
- **Auto-Rename**: `[Author]_[Title]_[Year].pdf`
  - Example: `Einstein_Theory_of_Relativity_1905.pdf`
- **Folder Organization**: Create nested folders by search query
  - Example: `Downloads/scholar/machine_learning/` for "machine learning" search
- **Metadata Extraction**: Extract and save:
  - DOI
  - Authors
  - Publication year
  - Citation count
  - Journal/Conference name
  - Link to Scholar page

### 4.4 Download Progress UI
- **Popup Display**: Show real-time progress
  - Total PDFs found on page
  - Currently downloading: [X/Y]
  - File name & size being downloaded
  - Status: pending/downloading/completed/skipped/error
- **Visual Indicator**: Progress bar for overall batch
- **Error Handling**: Display reason if individual PDF fails

### 4.5 Metadata Storage
- **Format**: Save as JSON file per query (`metadata.json`) in folder
  - Example: `Downloads/scholar/machine_learning/metadata.json`
- **Contents**: Array of objects with:
  ```json
  {
    "title": "",
    "authors": [],
    "year": 0,
    "doi": "",
    "citations": 0,
    "journal": "",
    "scholarUrl": "",
    "downloadedFile": "",
    "downloadDate": "",
    "status": "success|skipped|error"
  }
  ```

### 4.6 Copyright Warning
- **First Use**: Display modal warning about copyright/terms of service
  - Alert user to verify papers are legally downloadable
  - Mention responsibility for academic use
  - Option to "I understand" and proceed
- **Re-show**: Once per session or dismissable

### 4.7 Scholar Filter Support
- **Scope**: Extension respects active Scholar filters on page:
  - Date range filters
  - Article type (papers, patents, citations)
  - Subject area filters
  - Author name filters
- **Implementation**: Download only papers matching current page filters

### 4.8 Download Statistics & Logging
- **Track Per Session**:
  - Total searches performed
  - Total PDFs found
  - Total PDFs downloaded
  - Total PDFs skipped (duplicates/errors)
  - Total data downloaded (MB)
  - Average download time
- **Storage**: Local storage (no cloud sync)
- **Display**: Stats dashboard in extension options page

---

## 5. Technical Requirements

### 5.1 Browser Support
- Chrome (primary)
- Firefox
- Safari

### 5.2 Permissions Needed
- `activeTab` - access current Scholar page
- `downloads` - manage PDF downloads
- `storage` - store user preferences & stats
- `scripting` - parse page content
- Host: `https://scholar.google.com/*`

### 5.3 Download Behavior
- **Default Location**: User's Downloads folder (or custom path via options)
- **File Limit**: No size limits
- **Concurrent Downloads**: 2-3 parallel (avoid rate limiting)
- **Retry Logic**: Retry failed downloads up to 2 times

### 5.4 Rate Limiting Strategy
- Add 500ms-2s delay between downloads
- Detect 429 (Too Many Requests) responses
- Pause batch, alert user, resume after cooldown (5-10 min)
- Log failed attempts

---

## 6. User Interface

### 6.1 Popup (Main Interface)
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
│ [Download All] [Pause] [X]  │
│                             │
│ [⚙ Options] [📊 Stats]      │
└─────────────────────────────┘
```

### 6.2 Options Page
- Toggle: Auto-organize by query (on/off)
- Custom download folder path
- Download delay (ms) slider
- View download statistics
- Clear stats button
- Rate limit cooldown setting

### 6.3 Notifications
- Download complete toast notification
- Error alerts (with retry option)
- Rate limit warning

---

## 7. Success Metrics (MVP)

- [ ] Extension installs without errors
- [ ] Batch downloads ≥5 PDFs from single search page
- [ ] Auto-naming works correctly (no special chars issues)
- [ ] Duplicates properly skipped
- [ ] Rate limiting handled gracefully
- [ ] Metadata JSON created per search query
- [ ] Copyright warning displays on first use
- [ ] Stats tracking functional
- [ ] Works across Chrome/Firefox/Safari

---

## 8. Out of Scope (V2+)

- Cross-device sync
- Full-text search across downloaded PDFs
- Cloud storage integration
- Custom naming templates
- Email digest of downloads
- Browser history integration
- OCR on downloaded PDFs

---

## 9. Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Scholar rate limiting blocks extension | Implement exponential backoff, cooldown detection, user pause option |
| Duplicate file handling | Compare by title/DOI before download; overwrite prompt |
| Invalid PDFs (0 bytes) | Validate file size post-download, retry or mark as error |
| Copyright violations | Display warning, user assumes responsibility |
| Special characters in filenames | Sanitize: replace [^a-zA-Z0-9_-] with _ |

---

## 10. Timeline & Phases

**Phase 1 (MVP)**: Core batch download + folder organization + metadata  
**Phase 2**: Enhanced UI/UX, cross-browser polish  
**Phase 3**: Stats dashboard, advanced filters  
**Phase 4**: Optmizations & edge case handling

---

## 11. Acceptance Criteria

- User logs into Google Scholar
- User performs search query (e.g., "machine learning")
- User clicks "Download All Free PDFs"
- Extension downloads all available free PDFs to organized folder
- Each PDF renamed with [Author_Title_Year] format
- Metadata JSON created with paper details
- Progress UI shows real-time status
- Duplicate detection prevents re-downloads
- Copyright warning shown on first use
- Stats updated post-download
