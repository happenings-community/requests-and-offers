/**
 * Names for the entry and link types the inspector shows. An action only
 * carries `{ zome_index, entry_index }` or `{ zome_index, link_type }`, and no
 * admin call returns the names, so the app's adapter supplies them
 * (scripts/inspector-adapter.mts); a zome it does not know shows by index.
 */

/** Variant names of `pub enum <name> { ... }` in a Rust source, in declaration order. */
export function enumVariants(source: string, name: 'EntryTypes' | 'LinkTypes'): string[] {
  const match = new RegExp(`pub enum ${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('//'))
    .map((line) => /^([A-Z][A-Za-z0-9_]*)/.exec(line)?.[1])
    .filter((v): v is string => Boolean(v));
}

/** Per zome index: its entry and link type names. */
export type ZomeTypes = Array<{ zome: string; entries: string[]; links: string[] }>;

/** A zome's entry and link type names, in declaration order, or null when unknown. */
export type ZomeNames = (zome: string) => { entries: string[]; links: string[] } | null;

/** The types of a DNA's integrity zomes, in zome-index order. */
export function zomeTypes(integrityZomes: string[], names: ZomeNames): ZomeTypes {
  return integrityZomes.map((zome) => ({ zome, ...(names(zome) ?? { entries: [], links: [] }) }));
}

export function entryTypeName(types: ZomeTypes, zomeIndex: number, entryIndex: number): string {
  return types[zomeIndex]?.entries[entryIndex] ?? `${types[zomeIndex]?.zome ?? `zome ${zomeIndex}`} #${entryIndex}`;
}

export function linkTypeName(types: ZomeTypes, zomeIndex: number, linkType: number): string {
  return types[zomeIndex]?.links[linkType] ?? `${types[zomeIndex]?.zome ?? `zome ${zomeIndex}`} link ${linkType}`;
}
