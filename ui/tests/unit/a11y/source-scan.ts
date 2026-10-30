/**
 * Reads every Svelte component and TypeScript module under src/ with the Svelte
 * compiler's parser, so the a11y guards check the real markup and settings
 * objects rather than matching text.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'svelte/compiler';

export const SRC = join(__dirname, '../../../src');

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the compiler's AST is walked without its types
export type Node = { type: string; start: number; end: number; [k: string]: any };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the compiler's AST is walked without its types
export type Source = { file: string; text: string; ast: any | null };

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkFiles(p, out);
    else if (p.endsWith('.svelte') || (p.endsWith('.ts') && !p.endsWith('.d.ts'))) out.push(p);
  }
  return out;
}

let cache: Source[] | null = null;

/** Every source file, parsed once. A `.ts` module is parsed as the script of an empty component. */
export function sources(): Source[] {
  if (cache) return cache;
  cache = walkFiles(SRC).map((p) => {
    const raw = readFileSync(p, 'utf8');
    const isTs = p.endsWith('.ts');
    // A closing script tag inside a comment or string would end the wrapper early; the
    // replacement keeps every offset where it was.
    const text = isTs
      ? `<script lang="ts">${raw.replaceAll('</script', '<!script')}</script>`
      : raw;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the compiler's AST is walked without its types
    let ast: any = null;
    try {
      ast = parse(text, { modern: true });
    } catch (error) {
      // Svelte's script parser does not take every TypeScript form (`export type *`, for one).
      // A component that fails is a real failure; a module is reported by `unparsed()`.
      if (!isTs) throw error;
    }
    return { file: relative(SRC, p), text, ast };
  });
  return cache;
}

/** TypeScript modules the parser could not read, so a guard can refuse to pass over one that matters. */
export function unparsed(): Source[] {
  return sources().filter((s) => !s.ast);
}

/** Parsed sources only. */
export function parsed(): Source[] {
  return sources().filter((s) => s.ast);
}

/** Line number of an offset, counted in the file as written. */
export function lineOf(src: Source, offset: number): number {
  const shift = src.file.endsWith('.ts') ? '<script lang="ts">'.length : 0;
  return src.text.slice(shift, Math.max(shift, offset)).split('\n').length;
}

/** Depth-first walk over any ESTree or Svelte template node, with the ancestor chain. */
export function walk(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the compiler's AST is walked without its types
  node: any,
  visit: (n: Node, ancestors: Node[]) => void,
  ancestors: Node[] = []
) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit, ancestors);
    return;
  }
  if (typeof node.type === 'string') visit(node as Node, ancestors);
  const next = typeof node.type === 'string' ? [...ancestors, node as Node] : ancestors;
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'metadata' || key === 'loc') continue;
    const value = node[key];
    if (value && typeof value === 'object') walk(value, visit, next);
  }
}

/** Template elements (HTML elements and components) by name. */
export function elements(src: Source, names: string[]): { node: Node; ancestors: Node[] }[] {
  const found: { node: Node; ancestors: Node[] }[] = [];
  walk(src.ast.fragment, (n, ancestors) => {
    if ((n.type === 'RegularElement' || n.type === 'Component') && names.includes(n.name)) {
      found.push({ node: n, ancestors });
    }
  });
  return found;
}

export function attr(el: Node, name: string): Node | undefined {
  return (el.attributes ?? []).find((a: Node) => a.type === 'Attribute' && a.name === name);
}

export function hasSpread(el: Node): boolean {
  return (el.attributes ?? []).some((a: Node) => a.type === 'SpreadAttribute');
}

/** The static text of an attribute, or null if it is an expression or absent. */
export function staticAttr(el: Node, name: string): string | null {
  const a = attr(el, name);
  if (!a) return null;
  if (a.value === true) return '';
  const parts = Array.isArray(a.value) ? a.value : [a.value];
  if (parts.every((p: Node) => p.type === 'Text')) return parts.map((p: Node) => p.data).join('');
  return null;
}

export function where(src: Source, n: Node): string {
  return `${src.file}:${lineOf(src, n.start)}`;
}
