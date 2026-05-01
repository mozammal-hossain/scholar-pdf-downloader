function sanitizeFilename(filename) {
  if (!filename) return 'unknown';
  return filename
    .replace(/[^a-zA-Z0-9_\-.\s]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 200);
}

function parseAuthorsYear(authorYearString) {
  if (!authorYearString) {
    return { authors: [], year: null, journal: null };
  }

  const parts = authorYearString.split(' - ');
  const authorsPart = parts[0] || '';
  const journalYearPart = parts[1] || '';

  const authors = authorsPart
    .split(',')
    .map(a => a.trim())
    .filter(a => a);

  const yearMatch = journalYearPart.match(/\d{4}/);
  const year = yearMatch ? parseInt(yearMatch[0]) : null;

  const journal = journalYearPart.split(',')[0]?.trim() || null;

  return { authors, year, journal };
}

function extractCitationCount(citationText) {
  const match = citationText.match(/Cited by (\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function isLoggedIn() {
  // Basic check: presence of user profile link in Scholar page
  return document.querySelector('a[href*="accounts/"]') !== null;
}

function getCurrentQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get('q') || '';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(date) {
  return new Date(date).toISOString();
}
