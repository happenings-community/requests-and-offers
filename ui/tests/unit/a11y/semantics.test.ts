/**
 * Guards for the mechanical accessibility fixes in #209. Each test reads every component and
 * module under src/ and lists the sites that break its rule, so a failure names the file and line.
 */
import { describe, expect, it } from 'vitest';
import {
  attr,
  elements,
  hasSpread,
  parsed,
  staticAttr,
  unparsed,
  walk,
  where,
  type Node,
  type Source
} from './source-scan';

const MODAL_TYPES = ['component', 'confirm', 'alert', 'prompt'];

function isElement(n: Node | undefined, name?: string): boolean {
  return !!n && n.type === 'RegularElement' && (name === undefined || n.name === name);
}

/** Whether an element's content gives it a name: text with a letter, an expression, a component, or an image with alt text. */
function hasContentName(el: Node): boolean {
  let named = false;
  walk(el.fragment, (n, ancestors) => {
    if (ancestors.some((a) => isElement(a) && attr(a, 'aria-hidden'))) return;
    if (isElement(n) && attr(n, 'aria-hidden')) return;
    if (n.type === 'Text' && /\p{L}{2,}/u.test(n.data)) named = true;
    if (n.type === 'ExpressionTag' || n.type === 'HtmlTag' || n.type === 'RenderTag') named = true;
    if (n.type === 'Component' && n.name !== 'Avatar') named = true;
    if (isElement(n, 'img') && staticAttr(n, 'alt') !== '') named = true;
  });
  return named;
}

function hasOwnName(el: Node): boolean {
  return (
    !!attr(el, 'aria-label') || !!attr(el, 'aria-labelledby') || hasSpread(el) || hasContentName(el)
  );
}

function collect(check: (src: Source, out: string[]) => void): string[] {
  const out: string[] = [];
  for (const src of parsed()) check(src, out);
  return out;
}

describe('accessibility semantics (#209)', () => {
  it('reads every module that triggers a modal', () => {
    const missed = unparsed()
      .filter((s) => /modalStore|ModalSettings/.test(s.text))
      .map((s) => s.file);
    expect(missed).toEqual([]);
  });

  it('names every dialog: each modal settings object sets a title', () => {
    const unnamed = collect((src, out) => {
      for (const script of [src.ast.instance, src.ast.module].filter(Boolean)) {
        walk(script.content, (n) => {
          if (n.type !== 'ObjectExpression') return;
          const props = n.properties.filter((p: Node) => p.type === 'Property');
          const isModal = props.some(
            (p: Node) =>
              p.key?.name === 'type' &&
              p.value?.type === 'Literal' &&
              MODAL_TYPES.includes(p.value.value)
          );
          if (isModal && !props.some((p: Node) => p.key?.name === 'title')) out.push(where(src, n));
        });
      }
    });
    expect(unnamed).toEqual([]);
  });

  it('gives every table header cell a scope', () => {
    const missing = collect((src, out) => {
      for (const { node } of elements(src, ['th']))
        if (!attr(node, 'scope')) out.push(where(src, node));
    });
    expect(missing).toEqual([]);
  });

  it('hides decorative svgs, or gives an informative one a role', () => {
    const exposed = collect((src, out) => {
      for (const { node } of elements(src, ['svg'])) {
        if (staticAttr(node, 'aria-hidden') === 'true' || attr(node, 'role')) continue;
        out.push(where(src, node));
      }
    });
    expect(exposed).toEqual([]);
  });

  it('names every button and link', () => {
    const unnamed = collect((src, out) => {
      for (const { node } of elements(src, ['button', 'a'])) {
        if (!hasOwnName(node)) out.push(where(src, node));
      }
    });
    expect(unnamed).toEqual([]);
  });

  it('nests no label inside another', () => {
    const nested = collect((src, out) => {
      for (const { node, ancestors } of elements(src, ['label'])) {
        if (ancestors.some((a) => isElement(a, 'label'))) out.push(where(src, node));
      }
    });
    expect(nested).toEqual([]);
  });

  it('labels every form control', () => {
    const unlabelled = collect((src, out) => {
      const labelFor = new Set(
        elements(src, ['label'])
          .map(({ node }) => staticAttr(node, 'for'))
          .filter(Boolean)
      );
      for (const { node, ancestors } of elements(src, ['input', 'select', 'textarea'])) {
        const type = staticAttr(node, 'type') ?? '';
        if (['hidden', 'submit', 'button', 'reset'].includes(type)) continue;
        if (hasSpread(node) || attr(node, 'aria-label') || attr(node, 'aria-labelledby')) continue;
        if (ancestors.some((a) => isElement(a, 'label'))) continue;
        const id = staticAttr(node, 'id');
        if (id !== null && labelFor.has(id)) continue;
        // An id built from an expression pairs with a label built the same way; read by hand.
        if (attr(node, 'id') && id === null) continue;
        out.push(where(src, node));
      }
    });
    expect(unlabelled).toEqual([]);
  });

  it('announces loading messages', () => {
    const silent = collect((src, out) => {
      for (const { node, ancestors } of elements(src, ['p', 'span', 'div'])) {
        const nodes = node.fragment.nodes;
        if (!nodes.every((c: Node) => c.type === 'Text')) continue;
        const text = nodes
          .map((c: Node) => c.data)
          .join('')
          .trim();
        if (!/^Loading\b/.test(text)) continue;
        const live = [node, ...ancestors].some(
          (a) => isElement(a) && (attr(a, 'role') || attr(a, 'aria-live'))
        );
        if (!live) out.push(where(src, node));
      }
    });
    expect(silent).toEqual([]);
  });
});
