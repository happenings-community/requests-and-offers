/**
 * Holochain runs a cell's `init()` callbacks on the first zome call into it. Any other call
 * that arrives meanwhile waits for them, and after 30 seconds fails with "Another zome
 * function has triggered the `init()` callback, which has been blocking this zome call for
 * longer than 30 seconds. Giving up." On a new install the first `init()` can take longer
 * than that (dogfooding, 22 November 2026: about 50 seconds, two agents on a fresh sandbox),
 * so a call that only waited too long is worth one more try: the wait is over by then, or
 * nearly.
 */
export function isInitWaitTimeout(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /init\(\)`? callback, which has been blocking this zome call/.test(text);
}

/**
 * Runs `call`, and once more if it failed only because another call's `init()` kept it
 * waiting. Any other failure, and a second failure, is thrown as it came.
 */
export async function retryOnceAfterInitWait<T>(
  call: () => Promise<T>,
  onRetry?: () => void
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!isInitWaitTimeout(error)) throw error;
    onRetry?.();
    return call();
  }
}
