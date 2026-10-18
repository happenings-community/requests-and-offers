/**
 * The Alt+A admin shortcut (#206).
 *
 * Alt+A moves an administrator between a page and its admin counterpart. It must never fire
 * while someone is typing: on a Mac, Option+A types "å", and on Windows AltGr (Ctrl+Alt) types
 * letters such as the Polish "ą". Firing there navigates away and discards the form.
 */

type ShortcutEvent = Pick<
  KeyboardEvent,
  'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'code' | 'isComposing' | 'target'
>;

/** True when the event comes from somewhere the user types: a field, a list box, or editable content. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  const element = target as HTMLElement;
  if (element.isContentEditable) return true;
  return (
    element.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !==
    null
  );
}

/** True only for a plain Alt+A pressed outside anything the user types into. */
export function isAdminShortcut(event: ShortcutEvent): boolean {
  if (!event.altKey || event.code !== 'KeyA') return false;
  if (event.ctrlKey || event.metaKey || event.shiftKey) return false;
  if (event.isComposing) return false;
  return !isTypingTarget(event.target);
}

/** The value for `aria-keyshortcuts` on the Admin button, and the text its tooltip shows. */
export const ADMIN_SHORTCUT_ARIA = 'Alt+A';
