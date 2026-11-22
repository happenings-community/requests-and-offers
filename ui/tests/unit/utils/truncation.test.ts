import { describe, expect, it } from 'vitest';
import { isCut, measureOnHover } from '$lib/utils/truncation';

describe('isCut', () => {
  it('is true only when the text is wider than the box that shows it', () => {
    expect(isCut({ scrollWidth: 230, clientWidth: 132 })).toBe(true);
    expect(isCut({ scrollWidth: 132, clientWidth: 132 })).toBe(false);
    expect(isCut({ scrollWidth: 90, clientWidth: 132 })).toBe(false);
  });

  it('is false before the element exists', () => {
    expect(isCut(undefined)).toBe(false);
    expect(isCut(null)).toBe(false);
  });
});

describe('measureOnHover', () => {
  it('measures when the pointer enters or focus moves in, until it is destroyed', () => {
    const node = document.createElement('span');
    let calls = 0;
    const action = measureOnHover(node, () => calls++);
    node.dispatchEvent(new MouseEvent('mouseenter'));
    node.dispatchEvent(new FocusEvent('focusin'));
    expect(calls).toBe(2);
    let other = 0;
    action.update(() => other++);
    node.dispatchEvent(new MouseEvent('mouseenter'));
    expect([calls, other]).toEqual([2, 1]);
    action.destroy();
    node.dispatchEvent(new MouseEvent('mouseenter'));
    expect(other).toBe(1);
  });
});
