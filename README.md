# Scholar PDF Downloader

![Icon](icons/icon128.png)

Download research papers from Google Scholar in bulk — automatically organized and saved to your computer.

---

## Install

1. **Get the extension**
   - Download or clone this folder from GitHub
   - Or download as ZIP and extract

2. **Add to Chrome**
   - Type `chrome://extensions` in your address bar
   - Turn on **"Developer mode"** (toggle at top right)
   - Click **"Load unpacked"**
   - Select this folder
   - Done! Icon appears in your toolbar

---

## Use It

### Step 1: Search for papers
- Go to [Google Scholar](https://scholar.google.com)
- Search for anything (example: "machine learning", "climate change")
- Wait for results to load

### Step 2: Download
- Click the Scholar PDF Downloader icon in your toolbar
- You'll see how many papers were found
- Click **"Download All"**
- Watch the progress bar fill

### Step 3: Find your files
Papers save here: `Downloads → scholar → [your search]`

Example folder:
```
Downloads/
└── scholar/
    └── machine learning/
        ├── Author_Title_2023.pdf
        ├── Author2_Paper_2024.pdf
        └── metadata.json  (info about each paper)
```

---

## What You Can Do

**While downloading:**
- **Pause** — Stop for now, resume later
- **Resume** — Continue paused downloads
- **Clear** — Reset and start fresh

**Settings** (click "Settings" in popup):
- How many papers to download at once (1–10)
- Wait time between downloads (default is fine)

**Stats** (in Settings):
- See how many papers you've downloaded total
- See how many failed or duplicates skipped

---

## Common Issues

**No papers showing?**
- Make sure you're on a Google Scholar search results page
- Scroll down the page or search again
- Refresh and try again

**Downloads won't start?**
- Restart Chrome
- Try downloading just 1-2 papers first

**Getting blocked?**
- Extension pauses automatically if Google Scholar asks it to wait
- It resumes after 10 minutes
- If this keeps happening, reduce "papers at once" to 1-2 in Settings

**Files look weird?**
- Spaces become underscores in filenames (normal)
- Check the `metadata.json` file for the real paper name

---

## What Gets Saved

For each search, you get:
- **PDF files** — The actual research papers
- **metadata.json** — A list with paper details:
  - Title, authors, year
  - Where it came from
  - Download date
  - Success or failure status

---

## Questions or Issues?

Check the Chrome download history (Ctrl+Shift+J or Cmd+Shift+J on Mac) if something seems wrong.

The extension respects Google Scholar's rules — if it pauses, that's Google Scholar slowing things down, not a bug.

**Found a bug or have a feature request?** [Create an issue](https://github.com/mozammal-hossain/scholar-pdf-downloader/issues/new)
