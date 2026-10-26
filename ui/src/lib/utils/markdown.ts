import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { externalHref } from './external-link';

export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1') // italic
    .replace(/~~(.+?)~~/g, '$1') // strikethrough
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/^[-*+]\s+/gm, '') // list items
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/`(.+?)`/g, '$1'); // inline code
}

const MARKDOWN_OPTIONS = { breaks: true, gfm: true, async: false } as const;

// Browsers drop tabs and newlines anywhere in a URL before reading it.
const URL_IGNORED = /[\t\n\r]/g;
// `#x`, `?q`, `./x`, `../x` and `/path`, but not `//host` or `/\host`, which leave the app.
const IN_APP = /^(?:[#?]|\.{1,2}\/|\/(?![/\\]))/;
const MAIL_OR_PHONE = /^(?:mailto|tel):/i;
const WEB_SCHEME = /^https?:/i;

/**
 * Applies the typed-link rule of `externalHref` to a link inside rendered markdown.
 * In-app paths route as before, `mailto:` and `tel:` are kept, a web address opens in
 * a new window, and anything else loses its `href`, so its text stays readable.
 */
function settleAnchor(node: Element): void {
  if (node.tagName !== 'A') return;
  const href = node.getAttribute('href');
  if (href === null) return;

  const cleaned = href.replace(URL_IGNORED, '').trim();
  if (IN_APP.test(cleaned) || MAIL_OR_PHONE.test(cleaned)) return;

  const external = externalHref(cleaned);
  if (external) {
    // A link already written as http(s) keeps its spelling; only a bare address changes.
    if (!WEB_SCHEME.test(cleaned)) node.setAttribute('href', external);
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  } else {
    node.removeAttribute('href');
  }
}

/**
 * Renders user-entered markdown to sanitised HTML.
 *
 * A link written without a scheme (`[site](example.org)`) would otherwise resolve
 * against the page, and in the desktop shell (`webhapp://`) the router shows its 404.
 * Web addresses get their `https://` and open in a new window, which the shell hands
 * to the system browser.
 */
export function renderMarkdown(content: string): string {
  const html = marked.parse(content || '', MARKDOWN_OPTIONS) as string;
  DOMPurify.addHook('afterSanitizeAttributes', settleAnchor);
  try {
    return DOMPurify.sanitize(html);
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes', settleAnchor);
  }
}
