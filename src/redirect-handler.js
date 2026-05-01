// Redirect handler - extracts PDF URL and handles download

function extractPdfUrl() {
  // Try multiple methods to find actual PDF URL

  // Method 1: PDF.js viewer - look for PDFViewerApplication or viewer data
  if (window.PDFViewerApplication) {
    const pdfUrl = window.PDFViewerApplication.url;
    if (pdfUrl && pdfUrl.includes('.pdf')) {
      console.log('[Redirect] Found PDF.js URL:', pdfUrl);
      return pdfUrl;
    }
  }

  // Method 2: Check iframe src (some sites embed PDF in iframe)
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    const src = iframe.src;
    if (src && src.toLowerCase().includes('.pdf')) {
      console.log('[Redirect] Found iframe PDF:', src);
      return src;
    }
  }

  // Method 3: Look in data attributes or script data
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const text = script.textContent;
    if (text.toLowerCase().includes('.pdf')) {
      // Look for quoted PDF URLs
      const match = text.match(/["']([^"']*\.pdf[^"']*?)["']/i);
      if (match && match[1]) {
        console.log('[Redirect] Found PDF in script:', match[1]);
        return match[1];
      }
    }
  }

  // Method 4: Look for download button with href
  const downloadBtn = findDownloadButton();
  if (downloadBtn && downloadBtn.href && downloadBtn.href.toLowerCase().includes('.pdf')) {
    console.log('[Redirect] Found PDF in button href:', downloadBtn.href);
    return downloadBtn.href;
  }

  // Method 5: Check for PDF link in page
  const links = document.querySelectorAll('a[href*=".pdf"]');
  if (links.length > 0) {
    console.log('[Redirect] Found PDF link:', links[0].href);
    return links[0].href;
  }

  // Method 6: Check data attributes
  const elementsWithData = document.querySelectorAll('[data-pdf], [data-url], [data-src], [data-file]');
  for (const el of elementsWithData) {
    const pdf = el.getAttribute('data-pdf') || el.getAttribute('data-url') || el.getAttribute('data-src') || el.getAttribute('data-file');
    if (pdf && pdf.toLowerCase().includes('.pdf')) {
      console.log('[Redirect] Found PDF in data attribute:', pdf);
      return pdf;
    }
  }

  return null;
}

function findDownloadButton() {
  // Look for download button - common patterns
  const buttons = document.querySelectorAll('button, a, [role="button"]');

  for (const btn of buttons) {
    const text = btn.textContent.toLowerCase();
    const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
    const title = btn.getAttribute('title')?.toLowerCase() || '';
    const className = btn.className.toLowerCase();

    // Check for download indicators
    if (ariaLabel.includes('download')) {
      return btn;
    }

    if (title.includes('download')) {
      return btn;
    }

    // Check for download icon or text
    if (text.includes('download')) {
      return btn;
    }

    // Check for download-related class names
    if (className.includes('download') || className.includes('download-btn')) {
      return btn;
    }
  }

  return null;
}

function clickDownloadButton(button) {
  if (!button) return false;

  try {
    console.log('[Redirect] Clicking download button');
    button.click();
    return true;
  } catch (error) {
    console.error('[Redirect] Error clicking button:', error);
    return false;
  }
}

// Listen for messages from background worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Redirect] Received message:', request.type);

  if (request.type === 'extractPdfUrl') {
    // Try to extract PDF URL from page
    const pdfUrl = extractPdfUrl();

    if (pdfUrl) {
      console.log('[Redirect] ✓ Extracted PDF URL:', pdfUrl);
      sendResponse({ success: true, pdfUrl });
    } else {
      console.log('[Redirect] ✗ Could not extract PDF URL');
      sendResponse({ success: false, pdfUrl: null });
    }
  }

  if (request.type === 'findAndClickDownload') {
    // Try to find and click download button
    const button = findDownloadButton();

    if (button) {
      const clicked = clickDownloadButton(button);
      sendResponse({ found: true, clicked });
    } else {
      console.log('[Redirect] No download button found');
      sendResponse({ found: false, clicked: false });
    }
  }
});

console.log('[Redirect] Handler loaded on', window.location.href);
