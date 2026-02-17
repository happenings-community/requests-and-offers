import { describe, it, expect } from 'vitest';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Test the markdown rendering logic used by MarkdownRenderer.svelte
marked.setOptions({
  breaks: true,
  gfm: true
});

function renderMarkdown(content: string): string {
  return DOMPurify.sanitize(marked.parse(content || '') as string);
}

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
});
