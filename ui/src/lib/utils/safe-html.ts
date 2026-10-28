import DOMPurify from 'dompurify';

/**
 * HTML for dialogs (#211): the app's own wording may carry simple markup and
 * links, but nothing that runs. Member-supplied text never goes in as markup:
 * pass it through `escapeHtml` first.
 */

const ALLOWED_TAGS = [
  'a',
  'b',
  'strong',
  'i',
  'em',
  'br',
  'p',
  'div',
  'span',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'img'
];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'src', 'alt'];

// A private DOMPurify for dialogs, so its hook never reaches the shared instance
// that MarkdownRenderer uses: Markdown renders the same whether or not a dialog
// has opened.
let purify: ReturnType<typeof DOMPurify> | null = null;

function dialogPurifier() {
  if (purify) return purify;
  purify = DOMPurify(window);
  purify.addHook('afterSanitizeAttributes', (node) => {
    // Images only from the app itself, so a dialog can't load a tracker. The
    // browser's own URL parser decides, so "/\host" or "//host" can't pass.
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src') ?? '';
      let sameOrigin = false;
      try {
        sameOrigin = new URL(src, window.location.origin).origin === window.location.origin;
      } catch {
        sameOrigin = false;
      }
      if (!src || !sameOrigin) node.remove();
      return;
    }
    // Links that leave the app open apart from it and can't reach back in.
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') ?? '';
      if (/^https?:\/\//i.test(href)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      } else {
        node.removeAttribute('target');
        node.removeAttribute('rel');
      }
    }
  });
  return purify;
}

/** Keep simple markup and safe links; drop scripts, handlers, styles and foreign images. */
export function safeHtml(html: string): string {
  return dialogPurifier().sanitize(html ?? '', { ALLOWED_TAGS, ALLOWED_ATTR });
}

/** Text that must read as text inside HTML: a member's name, a listing title. */
export function escapeHtml(text: string): string {
  return (text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
