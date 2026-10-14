import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { isExternalHref, normalizeHref } from './links';

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

function normalizeAnchor(node: Element): void {
  if (node.tagName !== 'A') return;
  const href = node.getAttribute('href');
  if (href === null) return;

  const normalized = normalizeHref(href);
  if (normalized !== href) node.setAttribute('href', normalized);

  if (isExternalHref(normalized)) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
}

/**
 * Renders user-entered markdown to sanitised HTML.
 *
 * Links get a safe scheme (`example.com` becomes `https://example.com`) and
 * external ones open in a new window, so the desktop shell hands them to the
 * system browser instead of the in-app router.
 */
export function renderMarkdown(content: string): string {
  const html = marked.parse(content || '', MARKDOWN_OPTIONS) as string;
  DOMPurify.addHook('afterSanitizeAttributes', normalizeAnchor);
  try {
    return DOMPurify.sanitize(html);
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes', normalizeAnchor);
  }
}
