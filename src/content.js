function extractPapersFromPage() {
  const papers = [];
  const query = new URLSearchParams(window.location.search).get('q') || 'search';

  // Get all results
  const resultElements = document.querySelectorAll('.gs_ri');
  console.log(`[Scholar] Found ${resultElements.length} result elements`);

  // Get all PDF links (they have data-clk-atid attribute)
  const pdfLinks = Array.from(document.querySelectorAll('a[href$=".pdf"][data-clk-atid]'));
  console.log(`[Scholar] Found ${pdfLinks.length} PDF links`);

  resultElements.forEach((element, idx) => {
    try {
      const titleElement = element.querySelector('.gs_rt a');
      const authorElement = element.querySelector('.gs_a');
      const citationElement = element.querySelector('.gs_fl a[href*="cites="]');

      console.log(`[Scholar] Result ${idx}: title=${!!titleElement}, authors=${!!authorElement}`);

      if (!titleElement) {
        console.log(`[Scholar] Skipping result ${idx}: no title`);
        return;
      }

      const title = titleElement.textContent.trim();
      const scholarUrl = titleElement.href;

      const authorText = authorElement ? authorElement.textContent.trim() : '';
      const { authors, year, journal } = parseAuthorsYear(authorText);

      const citations = citationElement
        ? extractCitationCount(citationElement.textContent)
        : 0;

      // Match PDF link by index position on page
      // PDF links should be in same order as results
      const pdfLink = pdfLinks[idx];

      if (!pdfLink) {
        console.log(`[Scholar] Skipping "${title}": no PDF link available`);
        return;
      }

      const pdfUrl = pdfLink.href;

      let doi = null;
      const doiLink = element.querySelector('a[href*="doi.org"]');
      if (doiLink) {
        const doiMatch = doiLink.href.match(/doi\.org\/(.*)/);
        doi = doiMatch ? doiMatch[1] : null;
      }

      papers.push({
        title,
        authors,
        year,
        journal,
        citations,
        pdfUrl,
        doi,
        scholarUrl,
        query,
        filename: sanitizeFilename(`${authors[0] || 'Unknown'}_${title}_${year || 'undated'}`)
      });

      console.log(`[Scholar] ✓ Added: "${title}" (PDF: ${pdfUrl.substring(0, 50)}...)`);
    } catch (error) {
      console.error('[Scholar] Error parsing result:', error);
    }
  });

  console.log(`[Scholar] Extracted ${papers.length} papers total`);
  return papers;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Scholar] Received message:', request.type);
  if (request.type === 'getPapers') {
    const papers = extractPapersFromPage();
    console.log('[Scholar] Sending response with', papers.length, 'papers');
    sendResponse({ papers });
  }
});

console.log('[Scholar] Content script loaded on', window.location.href);
