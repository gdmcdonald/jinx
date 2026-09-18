// Helper function to get URL from redirect entry
function getRedirectUrl(entry) {
  return typeof entry === 'string' ? entry : entry.url;
}

// Helper function to get description from redirect entry
function getRedirectDescription(entry) {
  return typeof entry === 'string' ? '' : (entry.description || '');
}

// Global variables for search
let allLinks = [];
let currentSearchTerm = '';

// Main application functions
function getCurrentDomain() {
    const hostname = window.location.hostname;
    if (hostname.includes('github.io')) {
        return hostname + '/links';
    }
    return hostname;
}

function getShortlinkUrl(shortcut) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    if (hostname.includes('github.io')) {
        return `${protocol}//${hostname}/links/${shortcut}`;
    }
    return `${protocol}//${hostname}/${shortcut}`;
}

function showQR(url, shortcut, event) {
    event.stopPropagation();
    document.querySelector('.qr-popup')?.remove();

    // Generate QR code using Nayuki library
    const qr = qrcodegen.QrCode.encodeText(url, qrcodegen.QrCode.Ecc.MEDIUM);
    const scale = 4;
    const border = 2;
    const size = (qr.size + border * 2) * scale;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
            if (qr.getModule(x, y)) {
                ctx.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
            }
        }
    }

    const popup = document.createElement('div');
    popup.className = 'qr-popup';

    popup.innerHTML = `
        <div style="font-size:0.7rem;color:#666;margin-bottom:0.4rem;word-break:break-all;max-width:200px">${url}</div>
        <div style="text-align:center"></div>
        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;justify-content:center">
            <button id="qr-copy-btn" class="contrast">Copy</button>
            <button id="qr-download-btn" class="secondary">Download</button>
        </div>
    `;
    popup.querySelector('div:nth-child(2)').appendChild(canvas);

    const rect = event.currentTarget.getBoundingClientRect();
    const margin = 8;
    // Position: prefer below, flip above if near bottom of viewport
    const spaceBelow = window.innerHeight - rect.bottom;
    const popupHeight = 260;
    const top = spaceBelow > popupHeight
        ? rect.bottom + 6
        : rect.top - popupHeight - 6;
    popup.style.cssText = `position:fixed;z-index:9999;background:var(--pico-card-background-color,white);border:1px solid var(--pico-card-border-color,#ccc);border-radius:8px;padding:0.75rem;box-shadow:0 4px 12px rgba(0,0,0,0.15);top:${top}px;left:${rect.left}px`;
    document.body.appendChild(popup);
    // Clamp horizontally so popup stays within viewport
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.right > window.innerWidth - margin) {
        popup.style.left = `${window.innerWidth - popupRect.width - margin}px`;
    }
    if (popupRect.left < margin) {
        popup.style.left = `${margin}px`;
    }

    popup.querySelector('#qr-copy-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        // Pass promise directly so user gesture isn't lost in async callback
        const blobPromise = new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })])
            .then(() => showToast('QR code copied!'))
            .catch(() => showToast('Copy not supported in this browser'));
    });

    popup.querySelector('#qr-download-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        const filename = 'qr_' + url.replace(/^https?:\/\//, '').replace(/[./]/g, '_') + '.png';
        a.download = filename;
        a.click();
    });

    setTimeout(() => document.addEventListener('click', () => popup.remove(), { once: true }), 0);
}

function showToast(message) {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Hide and remove toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Link copied to clipboard!');
    }).catch(() => {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Link copied to clipboard!');
    });
}

function getDomainFromUrl(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

function getSimpleUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname + parsed.pathname;
    } catch {
        return url;
    }
}

function getFaviconUrl(url) {
    try {
        const domain = new URL(url).origin;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
        return null;
    }
}

function createLinkCard(shortcut, redirectEntry, searchTerm = '', fuzzy = false) {
    const destinationUrl = getRedirectUrl(redirectEntry);
    const description = getRedirectDescription(redirectEntry) || '';
    const shortlinkUrl = getShortlinkUrl(shortcut);
    const faviconUrl = getFaviconUrl(destinationUrl);

    const displayShortcut = highlightMatch(shortcut, searchTerm);
    const displayDescription = highlightMatch(description, searchTerm);

    return `
        <tr title="${destinationUrl}" ${fuzzy ? 'class="fuzzy-result"' : ''}
            data-shortcut="${shortcut}"
            data-description="${description.toLowerCase()}"
            data-url="${destinationUrl.toLowerCase()}">
            <td class="col-shortcut">
                ${faviconUrl ? `<img src="${faviconUrl}" alt="" class="favicon" onerror="this.style.display='none'">` : ''}
                <a href="${shortlinkUrl}" target="_blank">/${displayShortcut}</a>
            </td>
            <td class="col-description">${displayDescription}</td>
            <td class="col-copy">
                <span class="copy-btn" onclick="copyToClipboard('${shortlinkUrl}')" title="Copy short link">
                    <svg width="18" height="18" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <path d="M22.6,4H21.55a3.89,3.89,0,0,0-7.31,0H13.4A2.41,2.41,0,0,0,11,6.4V10H25V6.4A2.41,2.41,0,0,0,22.6,4ZM23,8H13V6.25A.25.25,0,0,1,13.25,6h2.69l.12-1.11A1.24,1.24,0,0,1,16.61,4a2,2,0,0,1,3.15,1.18l.09.84h2.9a.25.25,0,0,1,.25.25Z"/>
                        <path d="M33.25,18.06H21.33l2.84-2.83a1,1,0,1,0-1.42-1.42L17.5,19.06l5.25,5.25a1,1,0,0,0,.71.29,1,1,0,0,0,.71-1.7l-2.84-2.84H33.25a1,1,0,0,0,0-2Z"/>
                        <path d="M29,16h2V6.68A1.66,1.66,0,0,0,29.35,5H27.08V7H29Z"/>
                        <path d="M29,31H7V7H9V5H6.64A1.66,1.66,0,0,0,5,6.67V31.32A1.66,1.66,0,0,0,6.65,33H29.36A1.66,1.66,0,0,0,31,31.33V22.06H29Z"/>
                    </svg>
                </span>
            </td>
            <td class="col-qr">
                <span class="copy-btn" onclick="showQR('${shortlinkUrl}', '${shortcut}', event)" title="Show QR code">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h7v7H3zm1 1v5h5V4zm1 1h3v3H5zm8-2h7v7h-7zm1 1v5h5V4zm1 1h3v3h-3zM3 13h7v7H3zm1 1v5h5v-5zm1 1h3v3H5zm8 0h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2zm2-4h2v2h-2zm0 4h2v2h-2zm-4-2h2v2h-2z"/></svg>
                </span>
            </td>
        </tr>
    `;
}

function highlightMatch(text, searchTerm) {
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// Normalise separators so gpu-doc, gpu/doc, gpu_doc, "gpu doc" all match gpudoc
function normaliseTerm(term) {
    return term.toLowerCase().replace(/[\s\-_/]+/g, '');
}

let miniSearch = null;

function buildIndex() {
    miniSearch = new MiniSearch({
        fields: ['shortcut', 'shortcutNorm', 'description', 'url'],
        storeFields: ['shortcut', 'entry'],
        idField: 'shortcut',
        tokenize: str => str.split(/[\s\-_/]+/).filter(Boolean),
        processTerm: term => term.toLowerCase(),
        searchOptions: {
            prefix: true,
            fuzzy: term => Math.ceil(0.35 * term.length),
            boost: { shortcut: 3, shortcutNorm: 2, description: 2, url: 1 },
        }
    });

    const docs = allLinks.map(([shortcut, entry]) => ({
        shortcut,
        shortcutNorm: normaliseTerm(shortcut), // e.g. "gpu/docs" → "gpudocs"
        entry,
        description: getRedirectDescription(entry),
        url: getRedirectUrl(entry),
    }));
    miniSearch.addAll(docs);
}

function filterLinks(searchTerm) {
    const container = document.getElementById('links-container');
    const noResults = document.getElementById('no-results');
    const searchResultsCount = document.getElementById('search-results-count');

    if (!searchTerm.trim()) {
        const linkCards = allLinks.map(([shortcut, redirectEntry]) =>
            createLinkCard(shortcut, redirectEntry)
        ).join('');
        container.querySelector('tbody').innerHTML = linkCards;
        noResults.style.display = 'none';
        container.style.display = '';
        searchResultsCount.textContent = '';
        return;
    }

    const results = miniSearch.search(searchTerm);

    // Split into exact (prefix/substring) vs fuzzy
    // MiniSearch marks which terms matched via fuzzy in result.match
    const exactKeys = new Set();
    const fuzzyKeys = new Set();
    for (const r of results) {
        const isFuzzy = Object.values(r.match).some(fields =>
            fields.some(f => r.queryTerms && r.queryTerms.some(qt => !f.startsWith(qt)))
        );
        // Simpler heuristic: if score is high relative to others, treat as exact
        exactKeys.add(r.shortcut); // we'll separate by score below
    }

    // Separate by whether the normalised search term appears as a substring
    // "Exact" = every search token appears as a substring in the normalised fields
    const searchTokens = searchTerm.toLowerCase().split(/[\s\-_/]+/).filter(Boolean);
    const exactResults = results.filter(r => {
        const hay = normaliseTerm(`${r.shortcut} ${getRedirectDescription(r.entry)} ${getRedirectUrl(r.entry)}`);
        return searchTokens.every(tok => hay.includes(tok));
    });
    const exactSet = new Set(exactResults.map(r => r.shortcut));
    const fuzzyResults = results.filter(r => !exactSet.has(r.shortcut));

    const totalResults = results.length;

    if (totalResults === 0) {
        container.style.display = 'none';
        noResults.style.display = 'block';
        searchResultsCount.textContent = 'No results found';
    } else {
        let rows = exactResults.map(r =>
            createLinkCard(r.shortcut, r.entry, searchTerm)
        ).join('');

        if (fuzzyResults.length > 0) {
            rows += `<tr class="fuzzy-divider"><td colspan="4" style="font-size:0.75rem;color:var(--pico-muted-color);padding:0.4rem 0.5rem;border-top:1px dashed var(--pico-table-border-color)">Similar matches</td></tr>`;
            rows += fuzzyResults.map(r =>
                createLinkCard(r.shortcut, r.entry, searchTerm, true)
            ).join('');
        }

        container.querySelector('tbody').innerHTML = rows;
        container.style.display = '';
        noResults.style.display = 'none';

        const exactText = exactResults.length === 1 ? '1 result' : `${exactResults.length} results`;
        const fuzzyText = fuzzyResults.length > 0 ? `, ${fuzzyResults.length} similar` : '';
        searchResultsCount.textContent = exactText + fuzzyText + ' found';
    }

}

function setupSearch() {
    const searchInput = document.getElementById('search-input');
 
    // Real-time search as user types
    searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value;
        filterLinks(currentSearchTerm);
    });
    
    // Handle Enter key
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Maybe focus first result or do something else
        }
    });
    
    // Handle Escape key to clear search
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            currentSearchTerm = '';
            filterLinks('');
        }
    });
}

function renderLinks() {
    // Store all links for searching
    allLinks = Object.entries(REDIRECTS).sort(([a], [b]) => a.localeCompare(b));

    // Pre-fill search from URL param, e.g. ?bio or ?q=bio
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get('q') || [...params.keys()][0] || '';
    if (prefill) {
        const searchInput = document.getElementById('search-input');
        searchInput.value = prefill;
        currentSearchTerm = prefill;
    }

    // Build MiniSearch index
    buildIndex();

    // Initial render (filtered if prefill set)
    filterLinks(currentSearchTerm);

    // Setup search functionality
    setupSearch();
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', renderLinks);
