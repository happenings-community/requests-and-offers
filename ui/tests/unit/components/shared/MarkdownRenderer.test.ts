import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '$lib/utils/markdown';

// renderMarkdown is the rendering logic used by MarkdownRenderer.svelte
describe('MarkdownRenderer Component Logic', () => {
  describe('Basic Markdown Rendering', () => {
    it('should render bold text', () => {
      const result = renderMarkdown('**bold text**');
      expect(result).toContain('<strong>bold text</strong>');
    });

    it('should render italic text', () => {
      const result = renderMarkdown('*italic text*');
      expect(result).toContain('<em>italic text</em>');
    });

    it('should render headings', () => {
      const result = renderMarkdown('## Heading 2');
      expect(result).toContain('<h2');
      expect(result).toContain('Heading 2');
    });

    it('should render unordered lists', () => {
      const result = renderMarkdown('- item 1\n- item 2');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>item 1</li>');
      expect(result).toContain('<li>item 2</li>');
    });

    it('should render links', () => {
      const result = renderMarkdown('[link](https://example.com)');
      expect(result).toContain('<a href="https://example.com"');
      expect(result).toContain('link</a>');
    });
  });

  describe('Line Break Handling (breaks: true)', () => {
    it('should convert single newlines to <br>', () => {
      const result = renderMarkdown('line one\nline two');
      expect(result).toContain('<br>');
    });

    it('should preserve paragraph breaks', () => {
      const result = renderMarkdown('paragraph one\n\nparagraph two');
      expect(result).toContain('<p>paragraph one</p>');
      expect(result).toContain('<p>paragraph two</p>');
    });
  });

  describe('Backward Compatibility (Plain Text)', () => {
    it('should render plain text without artifacts', () => {
      const result = renderMarkdown('Just a simple description');
      expect(result).toContain('Just a simple description');
      // Should be wrapped in a paragraph
      expect(result).toContain('<p>');
    });

    it('should preserve plain text with line breaks', () => {
      const result = renderMarkdown('Line 1\nLine 2\nLine 3');
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
      expect(result).toContain('Line 3');
      expect(result).toContain('<br>');
    });
  });

  describe('XSS Sanitization', () => {
    it('should sanitize script tags', () => {
      const result = renderMarkdown('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should sanitize event handlers', () => {
      const result = renderMarkdown('<img src="x" onerror="alert(1)">');
      expect(result).not.toContain('onerror');
    });

    it('should sanitize javascript: URLs', () => {
      const result = renderMarkdown('[click me](javascript:alert(1))');
      expect(result).not.toContain('javascript:');
    });

    it('should allow safe HTML elements from markdown', () => {
      const result = renderMarkdown('**safe bold** and *safe italic*');
      expect(result).toContain('<strong>safe bold</strong>');
      expect(result).toContain('<em>safe italic</em>');
    });
  });

  describe('Empty and Edge Cases', () => {
    it('should handle empty string', () => {
      const result = renderMarkdown('');
      expect(result).toBe('');
    });

    it('should handle whitespace-only content', () => {
      const result = renderMarkdown('   ');
      expect(result).toBeDefined();
    });

    it('should handle special characters', () => {
      const result = renderMarkdown('Price: $100 & tax < 20%');
      expect(result).toContain('Price:');
      expect(result).toContain('$100');
    });
  });

  describe('GFM Features (gfm: true)', () => {
    it('should render strikethrough text', () => {
      const result = renderMarkdown('~~strikethrough~~');
      expect(result).toContain('<del>strikethrough</del>');
    });

    it('should render tables', () => {
      const table = '| Header |\n|--------|\n| Cell |';
      const result = renderMarkdown(table);
      expect(result).toContain('<table>');
      expect(result).toContain('Header');
      expect(result).toContain('Cell');
    });
  });

  describe('Links inside markdown (#300)', () => {
    const anchorOf = (markdown: string): HTMLAnchorElement => {
      const container = document.createElement('div');
      container.innerHTML = renderMarkdown(markdown);
      const anchor = container.querySelector('a');
      if (!anchor) throw new Error(`no anchor rendered for ${markdown}`);
      return anchor;
    };

    it.each([
      ['[a](https://example.com/x)', 'https://example.com/x'],
      ['https://example.com/bare', 'https://example.com/bare'],
      ['www.example.com/page', 'http://www.example.com/page'],
      ['[a](http://example.com/plain)', 'http://example.com/plain'],
      ['[a](example.com/page)', 'https://example.com/page'],
      ['[a](example.com)', 'https://example.com/']
    ])('opens %s at %s in a new window', (markdown, expected) => {
      const anchor = anchorOf(markdown);
      expect(anchor.getAttribute('href')).toBe(expected);
      expect(anchor.getAttribute('target')).toBe('_blank');
      expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it.each(['[req](/requests/abc)', '[top](#top)', '[next](?page=2)', '[rel](./x)'])(
      'keeps the in-app link %s routing inside the app',
      (markdown) => {
        const anchor = anchorOf(markdown);
        const href = /\(([^)]*)\)/.exec(markdown)?.[1];
        expect(anchor.getAttribute('href')).toBe(href);
        expect(anchor.hasAttribute('target')).toBe(false);
      }
    );

    it.each(['[mail](mailto:someone@example.com)', '[call](tel:+15145550000)'])(
      'keeps %s as it was written',
      (markdown) => {
        const anchor = anchorOf(markdown);
        expect(anchor.getAttribute('href')).toBe(/\(([^)]*)\)/.exec(markdown)?.[1]);
        expect(anchor.hasAttribute('target')).toBe(false);
      }
    );

    // Each of these leaves the app through the URL parser (`//host`, `/\host`, `\\host`, a tab
    // between the slashes) or names a scheme that is not a web address. None may keep an href.
    it.each([
      '[a](//evil.example/x)',
      '<a href="/\\evil.example/x">a</a>',
      '<a href="\\\\evil.example/x">a</a>',
      '<a href="/\t/evil.example/x">a</a>',
      '<a href="\u0001//evil.example/x">a</a>',
      '<a href=" //evil.example/x">a</a>',
      '[x](javascript:alert(1))',
      '<a href="java\tscript:alert(1)">x</a>',
      '<a href="vbscript:msgbox(1)">x</a>',
      '<a href="file:///etc/passwd">x</a>',
      '[app](webhapp://webhappwindow/x)',
      '[a](example.org?ref=ro)',
      '[a](www.example.org#top)',
      '[a](localhost)',
      '[rel](requests/abc)'
    ])('shows %s as text with no href', (markdown) => {
      const anchor = anchorOf(markdown);
      expect(anchor.hasAttribute('href')).toBe(false);
      expect(anchor.hasAttribute('target')).toBe(false);
    });

    // Clickable elements that are not HTML anchors: an SVG `<a>` (with `href` or
    // `xlink:href`), an image-map `<area>`, and a form whose submit leaves the app.
    it.each([
      '<svg><a href="//evil.example"><text>click</text></a></svg>',
      '<svg><a xlink:href="//evil.example"><text>click</text></a></svg>',
      '<svg><a href="example.org"><text>click</text></a></svg>',
      '<math><mi href="//evil.example">x</mi></math>',
      '<img src="/x.png" usemap="#m"><map name="m"><area shape="default" href="//evil.example"></map>',
      '<form action="//evil.example"><button>go</button></form>',
      '<button>go</button><input type="image" src="/x.png">'
    ])('leaves nothing in %s that can navigate', (markdown) => {
      const container = document.createElement('div');
      container.innerHTML = renderMarkdown(markdown);
      expect(container.querySelector('svg, math, area, map, form, button, input')).toBeNull();
      expect(container.querySelector('[href], [xlink\\:href], [action]')).toBeNull();
    });

    it('does not leave the link hook registered on DOMPurify', async () => {
      const { default: DOMPurify } = await import('dompurify');
      renderMarkdown('[a](example.com)');
      expect(DOMPurify.sanitize('<a href="example.com">a</a>')).toBe('<a href="example.com">a</a>');
    });
  });
});
