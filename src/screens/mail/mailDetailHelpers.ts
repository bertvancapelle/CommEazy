/**
 * Mail Detail Helpers
 *
 * Pure utility functions extracted from MailDetailScreen:
 * - Date formatting
 * - File size formatting
 * - Quoted-printable decoding
 * - URL shortening
 * - HTML document building for WebView
 * - Attachment icon mapping
 */

// ============================================================
// Date Formatting (Detailed)
// ============================================================

export function formatDetailDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString([], {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

// ============================================================
// Attachment Size Formatting
// ============================================================

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================
// Mail Body Formatting
// ============================================================

/**
 * Decode quoted-printable soft line breaks and encoded characters.
 * Quoted-printable encoding uses '=' followed by hex codes for special chars,
 * and '=' at end of line as a soft line break (continuation).
 */
function decodeQuotedPrintable(text: string): string {
  // Remove soft line breaks (= at end of line followed by newline)
  let result = text.replace(/=\r?\n/g, '');
  // Decode =XX hex sequences
  result = result.replace(/=([0-9A-Fa-f]{2})/g, (_match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  return result;
}

/**
 * Shorten long URLs for readability.
 * Shows domain + truncated path instead of full URL.
 * Example: "https://www.example.com/very/long/path?query=..." → "example.com/very/lon..."
 */
function shortenUrls(text: string): string {
  return text.replace(
    /https?:\/\/[^\s<>"{}|\\^`[\]]{40,}/g,
    (url) => {
      try {
        const parsed = new URL(url);
        const domain = parsed.hostname.replace(/^www\./, '');
        const pathPart = parsed.pathname + parsed.search;
        if (pathPart.length <= 1) return domain;
        const shortPath = pathPart.length > 20 ? pathPart.substring(0, 20) + '...' : pathPart;
        return domain + shortPath;
      } catch {
        // If URL parsing fails, truncate raw
        return url.substring(0, 50) + '...';
      }
    },
  );
}

/**
 * Format mail body text for display.
 * Handles quoted-printable decoding and URL shortening.
 */
export function formatMailBody(text: string): string {
  let result = decodeQuotedPrintable(text);
  result = shortenUrls(result);
  return result;
}

// ============================================================
// WebView HTML Builder
// ============================================================

/**
 * Build a complete HTML document for the WebView.
 *
 * Apple Mail strategy: respect the email's CSS fully (including display:none,
 * visibility:hidden, etc.) and let the email render as the sender intended.
 *
 * - Preserves original <style> tags for proper layout (tables, CSS classes)
 * - Strips <script> tags for security
 * - Strips MSO conditional comments (Outlook-specific markup)
 * - CSP blocks external images by default (img-src 'none')
 * - Injects base styling for senior-friendly readability
 * - Height fallback (5000px + scrollEnabled) when JS height measurement fails
 */
export function buildWebViewHtml(
  rawHtml: string,
  imagesAllowed: boolean,
  textColor: string,
  backgroundColor: string,
  linkColor: string,
  baseFontSize: number = 18,
): string {
  // Strip <script> tags entirely (security)
  const noScripts = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Strip Microsoft conditional comments (<!--[if mso]>...content...<![endif]-->)
  // These contain Outlook-specific markup that doesn't render in WebView
  // and can interfere with body/head extraction regex
  const noMsoComments = noScripts
    .replace(/<!--\[if\s[^\]]*mso[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<!--\[if\s[^\]]*mso[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, '');

  // CSP: block or allow external images
  const imgSrc = imagesAllowed ? "img-src * data: blob:" : "img-src data:";
  const csp = `default-src 'none'; style-src 'unsafe-inline'; ${imgSrc}; font-src 'none';`;

  // Check if HTML already has <html>/<body> structure
  const hasDocStructure = /<html[\s>]/i.test(noMsoComments);

  // Extract existing <style> blocks to preserve them
  // (they contain CSS classes needed for table/column layouts)
  let bodyContent = noMsoComments;

  if (hasDocStructure) {
    // Extract body content — keep styles that are in <head>
    const bodyMatch = noMsoComments.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const headMatch = noMsoComments.match(/<head[^>]*>([\s\S]*)<\/head>/i);
    const headStyles = headMatch
      ? (headMatch[1].match(/<style[\s\S]*?<\/style>/gi) || []).join('\n')
      : '';
    bodyContent = `${headStyles}\n${bodyMatch ? bodyMatch[1] : noMsoComments}`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style>
    /* Senior-friendly base styles */
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 8px;
      font-family: -apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif;
      font-size: ${baseFontSize}px;
      line-height: 1.55;
      color: ${textColor};
      background-color: ${backgroundColor};
      word-wrap: break-word;
      overflow-wrap: break-word;
      -webkit-text-size-adjust: 100%;
    }
    a { color: ${linkColor}; }
    img { max-width: 100%; height: auto; }
    table { max-width: 100%; border-collapse: collapse; }
    td, th { vertical-align: top; }
    /* Prevent horizontal overflow from wide tables */
    body > table, body > div > table {
      width: 100% !important;
      max-width: 100% !important;
    }
    /* Force table cells to wrap */
    td { word-break: break-word; }
    /* Hide tracking pixels (1x1 or hidden images) when images are loaded */
    img[width="1"], img[height="1"],
    img[style*="display:none"], img[style*="display: none"] {
      display: none !important;
    }
    pre, code {
      font-size: 15px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  </style>
</head>
<body>
${bodyContent}
<script>
  // Report content height to React Native — use max of multiple measurements
  function reportHeight() {
    var h = Math.max(
      document.body.scrollHeight || 0,
      document.body.offsetHeight || 0,
      document.documentElement.scrollHeight || 0,
      document.documentElement.offsetHeight || 0
    );
    if (h > 0) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: h }));
    }
  }
  // Report after load with multiple delayed checks for late-rendering content
  window.addEventListener('load', function() {
    reportHeight();
    setTimeout(reportHeight, 100);
    setTimeout(reportHeight, 300);
    setTimeout(reportHeight, 600);
    setTimeout(reportHeight, 1500);
    setTimeout(reportHeight, 3000);
  });
  // Observe DOM mutations (dynamic content, late-loading CSS)
  var observer = new MutationObserver(function() {
    reportHeight();
    setTimeout(reportHeight, 100);
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  // Also observe resize events (layout reflows)
  window.addEventListener('resize', reportHeight);

  // Handle image load requests from React Native
  window.addEventListener('message', function(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'loadImages') {
        // Remove CSP by creating a new meta tag
        var metas = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
        metas.forEach(function(m) { m.remove(); });
        var meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = "default-src 'none'; style-src 'unsafe-inline'; img-src * data: blob:; font-src 'none';";
        document.head.appendChild(meta);
        // Reload all images by updating their src
        var imgs = document.querySelectorAll('img');
        imgs.forEach(function(img) {
          var src = img.getAttribute('src') || img.getAttribute('data-src');
          if (src) {
            img.src = '';
            img.src = src;
          }
        });
        // Report new height after images load
        setTimeout(reportHeight, 500);
        setTimeout(reportHeight, 2000);
      }
    } catch(ex) {}
  });
</script>
</body>
</html>`;
}

// ============================================================
// Folder Name Normalization
// ============================================================

/**
 * Known folder name mappings from various providers to normalized keys.
 * These keys match the i18n keys in modules.mail.inbox.folders.*
 *
 * Gmail:    [Gmail]/Sent Mail, [Gmail]/Drafts, [Gmail]/Trash, [Gmail]/Spam
 * Outlook:  Sent Items, Deleted Items, Junk Email
 * Yahoo:    Sent, Draft, Trash, Bulk Mail
 * Generic:  Sent, Drafts, Trash, Junk, Archive, Spam
 */
const FOLDER_NAME_MAPPING: Record<string, string> = {
  // Sent folder variants
  'sent mail': 'sent',
  'sent items': 'sent',
  'sent messages': 'sent',
  'verzonden items': 'sent',
  'verzonden': 'sent',
  'envoy\u00e9s': 'sent',
  'gesendet': 'sent',
  'enviados': 'sent',
  'inviati': 'sent',
  // Draft folder variants
  'draft': 'drafts',
  'draft messages': 'drafts',
  'concepten': 'drafts',
  'brouillons': 'drafts',
  'entw\u00fcrfe': 'drafts',
  'borradores': 'drafts',
  'bozze': 'drafts',
  // Trash folder variants
  'deleted items': 'trash',
  'deleted messages': 'trash',
  'prullenbak': 'trash',
  'corbeille': 'trash',
  'papierkorb': 'trash',
  'papelera': 'trash',
  'cestino': 'trash',
  'bin': 'trash',
  // Junk/Spam folder variants
  'junk email': 'junk',
  'junk e-mail': 'junk',
  'bulk mail': 'spam',
  'courrier ind\u00e9sirable': 'spam',
  'spamverdacht': 'spam',
  'ongewenst': 'junk',
};

/**
 * Normalize a folder name to an i18n key.
 *
 * Strips provider prefixes like "[Gmail]/" and looks up known aliases.
 * Falls back to the last path component for display.
 *
 * @param folderName - Raw IMAP folder name (e.g. "[Gmail]/Sent Mail")
 * @returns Normalized key matching modules.mail.inbox.folders.* (e.g. "sent")
 */
export function normalizeFolderName(folderName: string): string {
  // Strip provider prefixes: [Gmail]/, [Google Mail]/, INBOX., etc.
  const stripped = folderName
    .replace(/^\[.*?\][/.]/, '')
    .replace(/^INBOX[/.]/, '');

  // Check exact match first (case-insensitive)
  const lowerStripped = stripped.toLowerCase();
  if (FOLDER_NAME_MAPPING[lowerStripped]) {
    return FOLDER_NAME_MAPPING[lowerStripped];
  }

  // Check last path component (for nested folders like "Folders/Sent")
  const lastComponent = stripped.replace(/^.*[/.]/, '');
  const lowerLast = lastComponent.toLowerCase();
  if (FOLDER_NAME_MAPPING[lowerLast]) {
    return FOLDER_NAME_MAPPING[lowerLast];
  }

  return lowerLast;
}

// ============================================================
// Attachment Icon Helper
// ============================================================

export function getAttachmentIconName(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'videocam';
  if (mimeType === 'application/pdf') return 'document-text';
  if (mimeType === 'text/calendar') return 'time';
  if (mimeType === 'text/vcard' || mimeType === 'text/x-vcard') return 'person';
  if (mimeType.startsWith('text/')) return 'document-text';
  if (
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('presentation') ||
    mimeType.includes('pages') ||
    mimeType.includes('numbers') ||
    mimeType.includes('keynote') ||
    mimeType.includes('rtf')
  ) return 'document';
  if (mimeType.includes('zip')) return 'folder';
  return 'attach';
}
