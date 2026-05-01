const concurrencyInput = document.getElementById('concurrency');
const delayMsInput = document.getElementById('delayMs');
const rateLimitCooldownInput = document.getElementById('rateLimitCooldown');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const saveMessage = document.getElementById('saveMessage');

const totalDownloadedEl = document.getElementById('totalDownloaded');
const totalSkippedEl = document.getElementById('totalSkipped');
const totalFailedEl = document.getElementById('totalFailed');
const lastDownloadEl = document.getElementById('lastDownload');
const totalPapersEl = document.getElementById('totalPapers');
const exportBtn = document.getElementById('exportBtn');
const clearStatsBtn = document.getElementById('clearStatsBtn');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;

    tabBtns.forEach((b) => b.classList.remove('active'));
    tabContents.forEach((tc) => tc.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(tabName).classList.add('active');

    if (tabName === 'stats') {
      loadStats();
    }
  });
});

async function loadSettings() {
  const settings = await StorageManager.getSettings();

  concurrencyInput.value = settings.concurrency || 2;
  delayMsInput.value = settings.delayMs || 500;
  rateLimitCooldownInput.value = (settings.rateLimitCooldownMs || 600000) / 60000;
}

async function saveSettings() {
  const settings = {
    concurrency: parseInt(concurrencyInput.value) || 2,
    delayMs: parseInt(delayMsInput.value) || 500,
    rateLimitCooldownMs: parseInt(rateLimitCooldownInput.value) * 60000 || 600000,
    downloadFolder: 'scholar'
  };

  await StorageManager.saveSettings(settings);

  saveMessage.textContent = 'Settings saved!';
  saveMessage.className = 'save-message success';

  setTimeout(() => {
    saveMessage.textContent = '';
    saveMessage.className = '';
  }, 2000);
}

function resetSettings() {
  concurrencyInput.value = 2;
  delayMsInput.value = 500;
  rateLimitCooldownInput.value = 10;
  saveSettings();
}

saveBtn.addEventListener('click', saveSettings);
resetBtn.addEventListener('click', resetSettings);

async function loadStats() {
  const stats = await StorageManager.getStats();

  totalDownloadedEl.textContent = stats.totalDownloaded || 0;
  totalSkippedEl.textContent = stats.totalSkipped || 0;
  totalFailedEl.textContent = stats.totalFailed || 0;

  const total = (stats.totalDownloaded || 0) + (stats.totalSkipped || 0) + (stats.totalFailed || 0);
  totalPapersEl.textContent = total;

  if (stats.lastDownloadDate) {
    const date = new Date(stats.lastDownloadDate);
    lastDownloadEl.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  } else {
    lastDownloadEl.textContent = '—';
  }
}

exportBtn.addEventListener('click', async () => {
  const stats = await StorageManager.getStats();
  const papers = await StorageManager.getDownloadedPapers();

  const exportData = {
    exportDate: new Date().toISOString(),
    stats,
    downloadedPapersCount: Object.keys(papers).length,
    downloadedPapers: papers
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

  const exportFileNameTimestamp = new Date().toISOString().slice(0, 10);
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', `scholar-stats-${exportFileNameTimestamp}.json`);
  linkElement.click();
});

clearStatsBtn.addEventListener('click', async () => {
  if (confirm('Clear all statistics? This cannot be undone.')) {
    await StorageManager.updateStats({
      totalDownloaded: 0,
      totalFailed: 0,
      totalSkipped: 0,
      lastDownloadDate: null
    });
    loadStats();
  }
});

loadSettings();
