// Helper function to get URL from redirect entry
function getRedirectUrl(entry) {
  return typeof entry === 'string' ? entry : entry.url;
}

// Helper function to get description from redirect entry
function getRedirectDescription(entry) {
  return typeof entry === 'string' ? '' : (entry.description || '');
}

// Get the shortlink slug from the current URL
function getShortlink() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    // If accessing via custom domain (e.g. jinx.fyi/shortlink)
    if (CONFIG.customDomain && hostname === CONFIG.customDomain) {
        return pathname.substring(1).replace(/\/$/, '').toLowerCase();
    }

    // If accessing via GitHub Pages (myorg.github.io/repoName/shortlink)
    if (hostname.includes('github.io') && CONFIG.repoName) {
        const parts = pathname.split('/');
        if (parts.length >= 3 && parts[1] === CONFIG.repoName) {
            return parts[2].replace(/\/$/, '').toLowerCase();
        }
        return '';
    }

    // Fallback
    return pathname.substring(1).replace(/\/$/, '').toLowerCase();
}

// Case-insensitive lookup, so a key stored with any casing in links.js
// (e.g. 'SideProject') still resolves for /sideproject, /SIDEPROJECT, etc.
// getShortlink() above already lowercases the incoming path, so we just
// need REDIRECTS itself indexed the same way.
const REDIRECTS_LOWER = Object.fromEntries(
    Object.entries(REDIRECTS).map(([key, value]) => [key.toLowerCase(), value])
);

const shortlink = getShortlink();
const redirectEntry = REDIRECTS_LOWER[shortlink];

let redirectUrl;
if (redirectEntry) {
    redirectUrl = getRedirectUrl(redirectEntry);
} else {
    // No match — send to directory search so user can find what they wanted
    const base = window.location.hostname.includes('github.io') && CONFIG.repoName
        ? `/${CONFIG.repoName}/`
        : '/';
    redirectUrl = `${window.location.protocol}//${window.location.hostname}${base}?q=${encodeURIComponent(shortlink)}`;
}

window.location.replace(redirectUrl);
