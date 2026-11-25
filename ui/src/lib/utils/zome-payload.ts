/**
 * A zome payload as plain data, the one form that may leave the page.
 *
 * In the desktop app a zome call is signed in the Electron main process, so the request
 * crosses IPC, which structured-clones it, and a Svelte `$state` proxy cannot be cloned:
 * the call fails with "An object could not be cloned" (#621). The web build signs inside
 * the page through msgpack, which reads a proxy like any object, so the failure only
 * shows on desktop and no web or e2e test sees it.
 *
 * Every zome call passes through `HolochainClientService.callZome`, and the hREA adapter
 * gets a client that passes through here too, so no call site has to remember to snapshot.
 *
 * Arrays and objects are copied (a `$state` proxy reads as a plain object or array, and a
 * class instance is copied to its own enumerable fields, which is all msgpack and the
 * structured clone keep of it anyway); binary data, dates, maps and sets are kept as they
 * are, since `$state` never proxies them. The copy is taken at call time, so a later edit
 * to the state it was read from cannot reach the call.
 */
export const toZomePayload = <T>(payload: T): T => plain(payload) as T;

const kept = (value: object): boolean =>
  ArrayBuffer.isView(value) ||
  value instanceof ArrayBuffer ||
  value instanceof Date ||
  value instanceof Map ||
  value instanceof Set;

const plain = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null || kept(value)) return value;
  if (Array.isArray(value)) return value.map(plain);
  return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, plain(field)]));
};
