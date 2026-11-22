/**
 * Whether an element's text is cut short: wider than the box that shows it, as a
 * `truncate` span is when its ellipsis is showing. Measured when it matters (on hover or
 * focus), since a cell's width changes with the window.
 */
export function isCut(
  el: Pick<HTMLElement, 'scrollWidth' | 'clientWidth'> | null | undefined
): boolean {
  return !!el && el.scrollWidth > el.clientWidth;
}

/**
 * Calls `measure` when the pointer enters the element or focus moves into it: the moments
 * a cut name is about to be wanted. An action rather than handlers, so a chip that is not
 * interactive (a span) needs no role to listen.
 */
export function measureOnHover(node: HTMLElement, measure: () => void) {
  let current = measure;
  const run = () => current();
  node.addEventListener('mouseenter', run);
  node.addEventListener('focusin', run);
  return {
    update(next: () => void) {
      current = next;
    },
    destroy() {
      node.removeEventListener('mouseenter', run);
      node.removeEventListener('focusin', run);
    }
  };
}
