import { describe, expect, it } from 'vitest';
import { isAdminShortcut } from '$lib/utils/admin-shortcut';

function press(target: EventTarget | null, keys: Partial<KeyboardEvent> = {}) {
  return {
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    code: 'KeyA',
    isComposing: false,
    target,
    ...keys
  } as KeyboardEvent;
}

function make(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host.firstElementChild as HTMLElement;
}

describe('isAdminShortcut', () => {
  it('fires for Alt+A on the page itself', () => {
    expect(isAdminShortcut(press(document.body))).toBe(true);
  });

  it('fires for Alt+A on a button or a link', () => {
    expect(isAdminShortcut(press(make('<button>Save</button>')))).toBe(true);
    expect(isAdminShortcut(press(make('<a href="/requests">Requests</a>')))).toBe(true);
  });

  it('does not fire while typing in a text field (Option+A types "å" on a Mac)', () => {
    expect(isAdminShortcut(press(make('<input type="text" />')))).toBe(false);
  });

  it('does not fire in a text area, a drop-down or a search field', () => {
    expect(isAdminShortcut(press(make('<textarea></textarea>')))).toBe(false);
    expect(isAdminShortcut(press(make('<select><option>a</option></select>')))).toBe(false);
    expect(isAdminShortcut(press(make('<input type="search" />')))).toBe(false);
  });

  it('does not fire inside editable content, including a child of it', () => {
    const editor = make('<div contenteditable="true"><p>Draft</p></div>');
    expect(isAdminShortcut(press(editor.querySelector('p')))).toBe(false);
  });

  it('does fire inside content marked contenteditable="false"', () => {
    expect(isAdminShortcut(press(make('<div contenteditable="false">Read only</div>')))).toBe(true);
  });

  it('does not fire for AltGr (Ctrl+Alt), which types "ą" on a Polish keyboard', () => {
    expect(isAdminShortcut(press(document.body, { ctrlKey: true }))).toBe(false);
  });

  it('does not fire with Cmd or Shift held', () => {
    expect(isAdminShortcut(press(document.body, { metaKey: true }))).toBe(false);
    expect(isAdminShortcut(press(document.body, { shiftKey: true }))).toBe(false);
  });

  it('does not fire mid-composition from an input method', () => {
    expect(isAdminShortcut(press(document.body, { isComposing: true }))).toBe(false);
  });

  it('does not fire for other keys or without Alt', () => {
    expect(isAdminShortcut(press(document.body, { code: 'KeyB' }))).toBe(false);
    expect(isAdminShortcut(press(document.body, { altKey: false }))).toBe(false);
  });

  it('copes with an event that has no element target', () => {
    expect(isAdminShortcut(press(null))).toBe(true);
    expect(isAdminShortcut(press(window))).toBe(true);
  });
});

describe('the layout uses the guarded check', () => {
  it('+layout.svelte decides Alt+A with isAdminShortcut, not a bare key test', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const layout = readFileSync(resolve(__dirname, '../../../src/routes/+layout.svelte'), 'utf8');
    expect(layout).toMatch(/isAdminShortcut\(event\)/);
    expect(layout).not.toMatch(/event\.altKey\s*&&\s*event\.code\s*===\s*'KeyA'/);
  });
});
