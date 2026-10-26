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

// Browsers drop tabs and newlines anywhere in a URL, and C0 controls and spaces at
// either end, before reading it.
const URL_IGNORED = /[\t\n\r]/g;
const isControlOrSpace = (char: string): boolean => char.charCodeAt(0) <= 0x20;
const trimControls = (value: string): string => {
  const chars = [...value];
  while (chars.length && isControlOrSpace(chars[0])) chars.shift();
  while (chars.length && isControlOrSpace(chars[chars.length - 1])) chars.pop();
  return chars.join('');
};
// `#x`, `?q`, `./x`, `../x` and `/path`, but not `//host` or `/\host`, which leave the app.
const IN_APP = /^(?:[#?]|\.{1,2}\/|\/(?![/\\]))/;
const MAIL_OR_PHONE = /^(?:mailto|tel):/i;
const WEB_SCHEME = /^https?:/i;

/**
 * Applies the typed-link rule of `externalHref` to a link inside rendered markdown.
 * In-app paths route as before, `mailto:` and `tel:` are kept, a web address opens in
 * a new window, and anything else loses its `href`, so its text stays readable. That
 * includes a bare relative path such as `requests/abc`, which would resolve against the
 * current page's folder. A bare address with a dot in its host (`example.org?ref=ro`)
 * is a web address under #382's rule and opens as `https:`.
 */
function settleAnchor(node: Element): void {
  if (node.nodeName.toLowerCase() !== 'a') return;
  const href = node.getAttribute('href');
  if (href === null) return;

  const cleaned = trimControls(href.replace(URL_IGNORED, ''));
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

// Markdown needs neither SVG nor MathML, whose links this hook does not see, and an
// image map or a form would be a click that leaves the app without being an anchor.
// Form controls go too: kept without their form, a button would submit whichever form
// the preview sits in (the profile form, for a bio).
const SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['form', 'map', 'area', 'button', 'input', 'select', 'textarea']
};

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
    return DOMPurify.sanitize(html, SANITIZE_OPTIONS);
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes', settleAnchor);
  }
}
