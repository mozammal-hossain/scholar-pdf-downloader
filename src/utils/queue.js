class DownloadQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.queue = [];
    this.active = 0;
    this.paused = false;
    this.pausedUntil = null;
  }

  add(paper) {
    this.queue.push(paper);
    this.process();
  }

  async process() {
    if (this.paused || this.active >= this.concurrency) {
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    const paper = this.queue.shift();
    this.active++;

    try {
      await this.downloadPaper(paper);
    } catch (error) {
      console.error(`Download failed for ${paper.title}:`, error);
      paper.error = error.message;
    }

    this.active--;
    this.process();
  }

  async downloadPaper(paper) {
    const sanitizedFilename = sanitizeFilename(paper.filename || paper.title);
    const downloadOptions = {
      url: paper.pdfUrl,
      filename: `scholar/${paper.query}/${sanitizedFilename}.pdf`,
      saveAs: false
    };

    return new Promise((resolve, reject) => {
      chrome.downloads.download(downloadOptions, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        const onDownloadDone = (delta) => {
          if (delta.id === downloadId && delta.state && delta.state.current === 'complete') {
            chrome.downloads.onChanged.removeListener(onDownloadDone);
            resolve();
          } else if (delta.id === downloadId && delta.state && delta.state.current === 'interrupted') {
            chrome.downloads.onChanged.removeListener(onDownloadDone);
            reject(new Error('Download interrupted'));
          }
        };

        chrome.downloads.onChanged.addListener(onDownloadDone);
      });
    });
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.process();
  }

  setPauseUntil(timestamp) {
    this.pausedUntil = timestamp;
    this.pause();
  }

  checkPauseExpiry() {
    if (this.pausedUntil && Date.now() >= this.pausedUntil) {
      this.pausedUntil = null;
      this.resume();
    }
  }

  clear() {
    this.queue = [];
  }

  getStatus() {
    return {
      queued: this.queue.length,
      active: this.active,
      paused: this.paused,
      pausedUntil: this.pausedUntil
    };
  }
}
