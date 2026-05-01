importScripts('src/utils/helpers.js', 'src/utils/storage.js', 'src/utils/queue.js');

let downloadQueue = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('settings', (result) => {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          downloadFolder: 'scholar',
          concurrency: 2,
          delayMs: 500,
          rateLimitCooldownMs: 600000
        }
      });
    }
  });

  chrome.storage.local.get('stats', (result) => {
    if (!result.stats) {
      chrome.storage.local.set({
        stats: {
          totalDownloaded: 0,
          totalFailed: 0,
          totalSkipped: 0,
          lastDownloadDate: null
        }
      });
    }
  });
});

async function initializeQueue() {
  const settings = await StorageManager.getSettings();
  downloadQueue = new DownloadQueue(settings.concurrency);
}

function broadcastProgress(status) {
  chrome.runtime.sendMessage(
    { type: 'downloadProgress', payload: status },
    () => chrome.runtime.lastError
  );
}

function isDirectPdfUrl(url) {
  // Check if URL is a direct PDF file or external redirect
  const urlObj = new URL(url);
  const pathname = urlObj.pathname.toLowerCase();

  // Direct PDF files end with .pdf
  if (pathname.endsWith('.pdf')) {
    return true;
  }

  // URLs to data.json, API endpoints, etc
  if (pathname.includes('/data.json') || pathname.includes('/api/')) {
    return true;
  }

  return false;
}

async function downloadPdfViaRedirect(pdfUrl, downloadPath) {
  return new Promise(async (resolve, reject) => {
    let tabId = null;
    let downloadCompleted = false;

    const timeout = setTimeout(() => {
      if (!downloadCompleted) {
        console.log('[Background] Download timeout - closing tab', tabId);
        if (tabId) {
          chrome.tabs.remove(tabId).catch(() => {});
        }
        if (downloadListener) {
          chrome.downloads.onChanged.removeListener(downloadListener);
        }
        reject(new Error('Download timeout - no PDF downloaded after 60s'));
      }
    }, 60000);

    const downloadListener = (delta) => {
      if (downloadCompleted) return;

      // Search for PDF downloads
      chrome.downloads.search({ id: delta.id }, (downloads) => {
        if (downloads.length === 0 || downloadCompleted) return;

        const download = downloads[0];
        const isPdf = download.filename?.toLowerCase().endsWith('.pdf') ||
                     download.mime === 'application/pdf';

        if (!isPdf) return;

        console.log('[Background] Download state:', delta.state?.current, '- file:', download.filename);

        if (delta.state?.current === 'complete') {
          console.log('[Background] ✓ PDF downloaded:', download.filename);
          downloadCompleted = true;
          clearTimeout(timeout);
          chrome.downloads.onChanged.removeListener(downloadListener);

          if (tabId) {
            chrome.tabs.remove(tabId).catch(() => {});
          }

          resolve();
        } else if (delta.state?.current === 'interrupted') {
          console.log('[Background] ✗ Download interrupted');
          downloadCompleted = true;
          clearTimeout(timeout);
          chrome.downloads.onChanged.removeListener(downloadListener);

          if (tabId) {
            chrome.tabs.remove(tabId).catch(() => {});
          }

          reject(new Error('Download interrupted'));
        }
      });
    };

    chrome.downloads.onChanged.addListener(downloadListener);

    try {
      const tab = await chrome.tabs.create({
        url: pdfUrl,
        active: false
      });

      tabId = tab.id;
      console.log('[Background] Opened redirect URL in tab', tabId);

      // Wait for page load + Cloudflare verification, then extract PDF URL
      setTimeout(async () => {
        if (downloadCompleted) return;

        try {
          console.log('[Background] Extracting PDF URL from loaded page...');
          const result = await chrome.tabs.sendMessage(tabId, {
            type: 'extractPdfUrl'
          });

          if (result.success && result.pdfUrl) {
            console.log('[Background] ✓ Extracted PDF URL:', result.pdfUrl);
            // Download the extracted PDF URL directly
            await downloadDirectPdf(result.pdfUrl, downloadPath);
            downloadCompleted = true;
            clearTimeout(timeout);
            chrome.downloads.onChanged.removeListener(downloadListener);
            if (tabId) {
              chrome.tabs.remove(tabId).catch(() => {});
            }
            resolve();
          } else {
            console.log('[Background] Could not extract PDF URL - trying to click button');
            // Fallback: try clicking download button
            const clickResult = await chrome.tabs.sendMessage(tabId, {
              type: 'findAndClickDownload'
            });
            console.log('[Background] Download button click result:', clickResult);
          }
        } catch (error) {
          console.log('[Background] Content script error:', error.message);
        }
      }, 8500);

    } catch (error) {
      clearTimeout(timeout);
      chrome.downloads.onChanged.removeListener(downloadListener);
      console.error('[Background] Error:', error);
      reject(error);
    }
  });
}

async function downloadDirectPdf(pdfUrl, downloadPath) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url: pdfUrl,
        filename: downloadPath,
        saveAs: false
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        const timeout = setTimeout(() => {
          chrome.downloads.onChanged.removeListener(onDownloadDone);
          reject(new Error('Direct PDF download timeout'));
        }, 60000);

        const onDownloadDone = (delta) => {
          if (delta.id !== downloadId) return;

          if (delta.state?.current === 'complete') {
            clearTimeout(timeout);
            chrome.downloads.onChanged.removeListener(onDownloadDone);
            console.log('[Background] ✓ Direct PDF download complete');
            resolve();
          } else if (delta.state?.current === 'interrupted') {
            clearTimeout(timeout);
            chrome.downloads.onChanged.removeListener(onDownloadDone);
            reject(new Error('Direct PDF download interrupted'));
          }
        };

        chrome.downloads.onChanged.addListener(onDownloadDone);
      }
    );
  });
}

async function downloadPaperWithMetadata(paper) {
  const isDuplicate = await StorageManager.isPaperDownloaded(paper.title);

  if (isDuplicate) {
    await StorageManager.incrementStat('totalSkipped', 1);
    return { status: 'skipped', paper };
  }

  const sanitizedFilename = sanitizeFilename(paper.filename || paper.title);
  const settings = await StorageManager.getSettings();
  const downloadPath = `${settings.downloadFolder}/${paper.query}/${sanitizedFilename}.pdf`;

  try {
    const isDirect = isDirectPdfUrl(paper.pdfUrl);

    if (isDirect) {
      // Direct PDF download
      await new Promise((resolve, reject) => {
        chrome.downloads.download(
          {
            url: paper.pdfUrl,
            filename: downloadPath,
            saveAs: false
          },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            const timeout = setTimeout(() => {
              chrome.downloads.onChanged.removeListener(onDownloadDone);
              reject(new Error('Download timeout'));
            }, 60000);

            const onDownloadDone = (delta) => {
              if (delta.id !== downloadId) return;

              if (delta.state?.current === 'complete') {
                clearTimeout(timeout);
                chrome.downloads.onChanged.removeListener(onDownloadDone);
                resolve();
              } else if (delta.state?.current === 'interrupted') {
                clearTimeout(timeout);
                chrome.downloads.onChanged.removeListener(onDownloadDone);
                reject(new Error('Download interrupted'));
              }
            };

            chrome.downloads.onChanged.addListener(onDownloadDone);
          }
        );
      });
    } else {
      // Redirect download - open tab, find and click download button
      await downloadPdfViaRedirect(paper.pdfUrl, downloadPath);
    }

    await StorageManager.markPaperAsDownloaded(paper.title, { filePath: downloadPath });
    await StorageManager.incrementStat('totalDownloaded', 1);

    return { status: 'success', paper };
  } catch (error) {
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      const settings = await StorageManager.getSettings();
      const pauseUntil = Date.now() + settings.rateLimitCooldownMs;

      await chrome.storage.local.set({ pausedUntil });
      broadcastProgress({
        paused: true,
        reason: 'Rate limited (429). Pausing for 10 minutes.',
        pausedUntil
      });

      return { status: 'rate_limited', paper };
    }

    await StorageManager.incrementStat('totalFailed', 1);
    return { status: 'error', paper, error: error.message };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request.type);

  if (request.type === 'startDownloads') {
    console.log('[Background] Starting downloads with', request.payload?.papers?.length, 'papers');
    handleStartDownloads(request.payload).then(sendResponse).catch((error) => {
      console.error('[Background] Download error:', error);
      sendResponse({ error: error.message });
    });
    return true;
  }

  if (request.type === 'pauseDownloads') {
    if (downloadQueue) {
      downloadQueue.pause();
      broadcastProgress({ paused: true });
      sendResponse({ success: true });
    }
    return true;
  }

  if (request.type === 'resumeDownloads') {
    if (downloadQueue) {
      downloadQueue.resume();
      broadcastProgress({ paused: false });
      sendResponse({ success: true });
    }
    return true;
  }

  if (request.type === 'getQueueStatus') {
    if (downloadQueue) {
      sendResponse({ status: downloadQueue.getStatus() });
    } else {
      sendResponse({ status: { queued: 0, active: 0, paused: false } });
    }
    return true;
  }

  if (request.type === 'getStats') {
    StorageManager.getStats().then((stats) => {
      sendResponse({ stats });
    });
    return true;
  }

  console.log('[Background] Unknown message type:', request.type);
});

async function handleStartDownloads(payload) {
  const { papers } = payload;

  if (!downloadQueue) {
    await initializeQueue();
  }

  downloadQueue.clear();

  const results = [];
  for (const paper of papers) {
    const result = await downloadPaperWithMetadata(paper);
    results.push(result);

    broadcastProgress({
      total: papers.length,
      processed: results.length,
      queued: downloadQueue.getStatus().queued,
      active: downloadQueue.getStatus().active,
      lastPaper: paper.title
    });

    const settings = await StorageManager.getSettings();
    await new Promise((resolve) => setTimeout(resolve, settings.delayMs));
  }

  const metadata = {
    query: papers[0]?.query || 'unknown',
    downloadDate: new Date().toISOString(),
    paperCount: papers.length,
    papers: results.map((r) => ({
      ...r.paper,
      status: r.status,
      error: r.error
    }))
  };

  await StorageManager.saveMetadata(papers[0]?.query || 'unknown', metadata);

  broadcastProgress({
    completed: true,
    total: papers.length,
    results
  });

  return results;
}

setInterval(async () => {
  const stored = await chrome.storage.local.get('pausedUntil');
  if (stored.pausedUntil && Date.now() >= stored.pausedUntil) {
    await chrome.storage.local.remove('pausedUntil');
    if (downloadQueue) {
      downloadQueue.resume();
      broadcastProgress({ paused: false, reason: 'Rate limit cooldown expired' });
    }
  }
}, 10000);
