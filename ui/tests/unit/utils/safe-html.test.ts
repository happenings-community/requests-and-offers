import { describe, expect, it } from 'vitest';
import DOMPurify from 'dompurify';
import { escapeHtml, safeHtml } from '$lib/utils/safe-html';

const render = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = safeHtml(html);
  return div;
};

describe('safeHtml', () => {
  it('drops scripts and event handlers', () => {
    const div = render(
      '<p>Hi</p><script>window.pwned = 1</script><img src="/logo.png" onerror="alert(1)">'
    );
    expect(div.querySelector('script')).toBeNull();
    expect(div.innerHTML).not.toContain('onerror');
    expect(div.querySelector('p')?.textContent).toBe('Hi');
  });

  it('refuses javascript: links but keeps the text', () => {
    const div = render('<a href="javascript:alert(1)">click</a>');
    expect(div.querySelector('a')?.getAttribute('href') ?? null).toBeNull();
    expect(div.textContent).toBe('click');
  });

  it('keeps a link out of the app, opening apart with no way back in', () => {
    const a = render(
      '<a href="https://happenings.community/agreement">agreement</a>'
    ).querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://happenings.community/agreement');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('keeps a link inside the app as an ordinary link', () => {
    const a = render('<a href="/offers" target="_blank">offers</a>').querySelector('a');
    expect(a?.getAttribute('href')).toBe('/offers');
    expect(a?.hasAttribute('target')).toBe(false);
  });

  it("allows the app's own images and refuses foreign ones", () => {
    expect(
      render('<img src="/hAppeningsCIClogo.png" alt="logo">').querySelector('img')
    ).not.toBeNull();
    expect(render('<img src="https://tracker.example/p.gif">').querySelector('img')).toBeNull();
    expect(render('<img src="//tracker.example/p.gif">').querySelector('img')).toBeNull();
  });

  it('refuses an image address the browser reads as another site', () => {
    // A backslash after the first slash reads as a second slash in a URL.
    expect(render('<img src="/\\evil.example/p.gif">').querySelector('img')).toBeNull();
    expect(render('<img src="data:image/gif;base64,R0lGOD">').querySelector('img')).toBeNull();
  });

  it('leaves the shared DOMPurify alone, so Markdown renders the same after a dialog', () => {
    const markdown =
      '<p><img src="https://example.org/avatar.png" alt="x"> <a href="https://example.org">site</a></p>';
    safeHtml('<p>a dialog</p>');
    const div = document.createElement('div');
    div.innerHTML = DOMPurify.sanitize(markdown);
    expect(div.querySelector('img')?.getAttribute('src')).toBe('https://example.org/avatar.png');
    expect(div.querySelector('a')?.hasAttribute('target')).toBe(false);
  });

  it('keeps simple formatting and line breaks', () => {
    const div = render('Sure?<br/><strong>This cannot be undone.</strong>');
    expect(div.querySelector('br')).not.toBeNull();
    expect(div.querySelector('strong')?.textContent).toBe('This cannot be undone.');
  });

  it('drops styles and iframes', () => {
    const div = render('<iframe src="https://x"></iframe><p style="position:fixed">x</p>');
    expect(div.querySelector('iframe')).toBeNull();
    expect(div.querySelector('p')?.hasAttribute('style')).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('makes markup in a name read as text', () => {
    const name = '<a href="https://evil.example">Click me</a><img src=x onerror=alert(1)>';
    const div = render(`<p>Hello ${escapeHtml(name)}</p>`);
    expect(div.querySelector('a')).toBeNull();
    expect(div.querySelector('img')).toBeNull();
    expect(div.textContent).toBe(`Hello ${name}`);
  });
});
