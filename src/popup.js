console.log('[Popup] Script starting');

let papers = [];
let isDownloading = false;
let isPaused = false;

console.log('[Popup] Getting DOM elements');
const downloadBtn = document.getElementById('downloadBtn');
console.log('[Popup] downloadBtn element:', downloadBtn);
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const clearBtn = document.getElementById('clearBtn');
const settingsBtn = document.getElementById('settingsBtn');
const statsBtn = document.getElementById('statsBtn');
const clearStorageBtn = document.getElementById('clearStorageBtn');
const foundCount = document.getElementById('foundCount');
const progressValue = document.getElementById('progressValue');
const progressFill = document.getElementById('progressFill');
const currentFileSection = document.getElementById('currentFileSection');
const currentFile = document.getElementById('currentFile');
const statusMessage = document.getElementById('statusMessage');

console.log('[Popup] Setting up button listeners');
console.log('[Popup] downloadBtn:', downloadBtn);
console.log('[Popup] pauseBtn:', pauseBtn);

downloadBtn.addEventListener('click', () => {
  console.log('[Popup] Download button clicked');
  startDownloads();
});
pauseBtn.addEventListener('click', pauseDownloads);
resumeBtn.addEventListener('click', resumeDownloads);
clearBtn.addEventListener('click', clearPapers);
settingsBtn.addEventListener('click', openSettings);
statsBtn.addEventListener('click', openStats);
clearStorageBtn.addEventListener('click', clearAllData);

console.log('[Popup] Button listeners set up complete');

async function extractPapersFromPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  console.log('[Popup] Sending getPapers to tab', tab.id, tab.url);

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { type: 'getPapers' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Popup] Error:', chrome.runtime.lastError);
        resolve([]);
      } else {
        console.log('[Popup] Got response:', response.papers?.length, 'papers');
        resolve(response.papers || []);
      }
    });
  });
}

async function loadPapers() {
  papers = await extractPapersFromPage();
  foundCount.textContent = papers.length;
  updateUI();
}

async function startDownloads() {
  console.log('[Popup] startDownloads called, papers:', papers.length);

  if (papers.length === 0) {
    statusMessage.textContent = 'No papers found. Try a different search.';
    statusMessage.className = 'status-message error';
    return;
  }

  isDownloading = true;
  isPaused = false;
  updateUI();
  statusMessage.textContent = 'Starting downloads...';
  statusMessage.className = 'status-message info';

  console.log('[Popup] Sending startDownloads message with', papers.length, 'papers');

  chrome.runtime.sendMessage(
    { type: 'startDownloads', payload: { papers } },
    (response) => {
      console.log('[Popup] startDownloads response:', response);
      if (chrome.runtime.lastError) {
        console.error('[Popup] lastError:', chrome.runtime.lastError);
        statusMessage.textContent = 'Error starting downloads.';
        statusMessage.className = 'status-message error';
      }
    }
  );
}

function pauseDownloads() {
  chrome.runtime.sendMessage({ type: 'pauseDownloads' }, () => {
    isPaused = true;
    updateUI();
    statusMessage.textContent = 'Downloads paused.';
    statusMessage.className = 'status-message warning';
  });
}

function resumeDownloads() {
  chrome.runtime.sendMessage({ type: 'resumeDownloads' }, () => {
    isPaused = false;
    updateUI();
    statusMessage.textContent = 'Downloads resumed.';
    statusMessage.className = 'status-message info';
  });
}

function clearPapers() {
  papers = [];
  foundCount.textContent = '0';
  progressValue.textContent = '0/0';
  progressFill.style.width = '0%';
  currentFileSection.style.display = 'none';
  statusMessage.textContent = '';
  isDownloading = false;
  updateUI();
}

async function openSettings() {
  chrome.runtime.openOptionsPage();
}

async function openStats() {
  chrome.runtime.openOptionsPage();
}

async function clearAllData() {
  if (confirm('Clear all downloaded papers registry and stats? This cannot be undone.')) {
    await StorageManager.clear();
    statusMessage.textContent = 'All data cleared.';
    statusMessage.className = 'status-message success';
  }
}

function updateUI() {
  downloadBtn.disabled = papers.length === 0 || isDownloading;
  pauseBtn.disabled = !isDownloading || isPaused;
  resumeBtn.disabled = !isDownloading || !isPaused;
  resumeBtn.style.display = isPaused ? 'inline-block' : 'none';
  pauseBtn.style.display = isPaused ? 'none' : 'inline-block';
  clearBtn.disabled = isDownloading;
}

function updateProgress(status) {
  if (status.completed) {
    isDownloading = false;
    statusMessage.textContent = `Completed: ${status.total} papers processed.`;
    statusMessage.className = 'status-message success';
    updateUI();
    return;
  }

  if (status.paused) {
    isPaused = true;
    statusMessage.textContent = status.reason || 'Downloads paused.';
    statusMessage.className = 'status-message warning';
    updateUI();
    return;
  }

  if (status.processed !== undefined && status.total !== undefined) {
    const percentage = (status.processed / status.total) * 100;
    progressValue.textContent = `${status.processed}/${status.total}`;
    progressFill.style.width = percentage + '%';
  }

  if (status.lastPaper) {
    currentFile.textContent = status.lastPaper;
    currentFileSection.style.display = 'flex';
  }

  if (status.reason) {
    statusMessage.textContent = status.reason;
    statusMessage.className = 'status-message warning';
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'downloadProgress') {
    updateProgress(request.payload);
  }
});

console.log('[Popup] Loading papers and updating UI');
loadPapers();
updateUI();
console.log('[Popup] Ready');
