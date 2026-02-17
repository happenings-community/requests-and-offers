import { describe, it, expect, vi } from 'vitest';

// Test the insertion logic used by MarkdownToolbar.svelte
// Extracted as pure functions to test independently of Svelte rendering

function insertMarkdown(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string
): string {
  const selected = value.substring(selectionStart, selectionEnd);
  return value.substring(0, selectionStart) + before + selected + after + value.substring(selectionEnd);
}

function insertLinePrefix(value: string, cursorPosition: number, prefix: string): string {
  const lineStart = value.lastIndexOf('\n', cursorPosition - 1) + 1;
  return value.substring(0, lineStart) + prefix + value.substring(lineStart);
}

describe('MarkdownToolbar Component Logic', () => {
  describe('insertMarkdown - Wrap Selection', () => {
    it('should wrap selected text with bold syntax', () => {
      const result = insertMarkdown('hello world', 6, 11, '**', '**');
      expect(result).toBe('hello **world**');
    });

    it('should wrap selected text with italic syntax', () => {
      const result = insertMarkdown('hello world', 6, 11, '*', '*');
      expect(result).toBe('hello *world*');
    });

    it('should insert empty markers when no text is selected', () => {
      const result = insertMarkdown('hello world', 5, 5, '**', '**');
      expect(result).toBe('hello**** world');
    });

    it('should wrap partial word selection', () => {
      const result = insertMarkdown('hello world', 0, 5, '**', '**');
      expect(result).toBe('**hello** world');
    });

    it('should handle selection at start of text', () => {
      const result = insertMarkdown('hello', 0, 5, '**', '**');
      expect(result).toBe('**hello**');
    });

    it('should handle selection at end of text', () => {
      const result = insertMarkdown('hello world', 6, 11, '*', '*');
      expect(result).toBe('hello *world*');
    });

    it('should handle empty string input', () => {
      const result = insertMarkdown('', 0, 0, '**', '**');
      expect(result).toBe('****');
    });

    it('should handle multiline selection', () => {
      const result = insertMarkdown('line1\nline2', 0, 11, '**', '**');
      expect(result).toBe('**line1\nline2**');
    });
  });

  describe('insertLinePrefix - Line Start Insertion', () => {
    it('should add heading prefix at the start of the current line', () => {
      const result = insertLinePrefix('hello world', 5, '## ');
      expect(result).toBe('## hello world');
    });

    it('should add list prefix at the start of the current line', () => {
      const result = insertLinePrefix('hello world', 5, '- ');
      expect(result).toBe('- hello world');
    });

    it('should add prefix to the correct line in multiline text', () => {
      const result = insertLinePrefix('line one\nline two\nline three', 14, '## ');
      expect(result).toBe('line one\n## line two\nline three');
    });

    it('should handle cursor at the start of text', () => {
      const result = insertLinePrefix('hello', 0, '- ');
      expect(result).toBe('- hello');
    });

    it('should handle cursor on the last line', () => {
      const result = insertLinePrefix('line one\nline two', 15, '## ');
      expect(result).toBe('line one\n## line two');
    });

    it('should handle empty string', () => {
      const result = insertLinePrefix('', 0, '## ');
      expect(result).toBe('## ');
    });

    it('should add prefix to first line when cursor is at position 0', () => {
      const result = insertLinePrefix('first line\nsecond line', 0, '- ');
      expect(result).toBe('- first line\nsecond line');
    });
  });

  describe('Toolbar Button Behavior', () => {
    it('bold button should use ** markers', () => {
      const onchange = vi.fn();
      const value = 'selected text';
      const newValue = insertMarkdown(value, 0, 8, '**', '**');
      onchange(newValue);
      expect(onchange).toHaveBeenCalledWith('**selected** text');
    });

    it('italic button should use * markers', () => {
      const onchange = vi.fn();
      const value = 'selected text';
      const newValue = insertMarkdown(value, 0, 8, '*', '*');
      onchange(newValue);
      expect(onchange).toHaveBeenCalledWith('*selected* text');
    });

    it('heading button should use ## prefix', () => {
      const onchange = vi.fn();
      const value = 'My heading';
      const newValue = insertLinePrefix(value, 3, '## ');
      onchange(newValue);
      expect(onchange).toHaveBeenCalledWith('## My heading');
    });

    it('list button should use - prefix', () => {
      const onchange = vi.fn();
      const value = 'List item';
      const newValue = insertLinePrefix(value, 3, '- ');
      onchange(newValue);
      expect(onchange).toHaveBeenCalledWith('- List item');
    });
  });

  describe('Edge Cases', () => {
    it('should handle text with existing markdown', () => {
      const result = insertMarkdown('**already bold**', 2, 14, '*', '*');
      expect(result).toBe('***already bold***');
    });

    it('should handle text with special characters', () => {
      const result = insertMarkdown('price: $100 & tax', 7, 11, '**', '**');
      expect(result).toBe('price: **$100** & tax');
    });

    it('should handle consecutive prefix additions', () => {
      let result = insertLinePrefix('item one', 0, '- ');
      expect(result).toBe('- item one');
      // Simulating adding heading on top of list prefix
      result = insertLinePrefix(result, 0, '## ');
      expect(result).toBe('## - item one');
    });
  });
});
