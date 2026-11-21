/**
 * Finds the item a reference names when both may be different revisions of one entry.
 * `rootOf` maps a hash (as `Uint8Array.toString()`) to its entry's original hash, as
 * the DHT resolves it; a hash it does not hold yet stands for itself, so an exact match
 * still works before resolution.
 */
export function findByRoot<T extends { original_action_hash?: { toString(): string } | null }>(
  items: readonly T[],
  hash: string,
  rootOf: ReadonlyMap<string, string>
): T | null {
  const root = rootOf.get(hash) ?? hash;
  return (
    items.find((item) => {
      const h = item.original_action_hash?.toString();
      return h !== undefined && (rootOf.get(h) ?? h) === root;
    }) ?? null
  );
}
