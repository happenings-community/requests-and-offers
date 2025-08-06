/**
 * Global initialization lock to prevent concurrent initialization of different domains
 * that could cause Holochain source chain race conditions.
 */

class InitializationLock {
  private locks = new Map<string, Promise<any>>();

  /**
   * Acquire a lock for a specific domain and execute the initialization function
   * @param domain The domain being initialized (e.g., 'service-types', 'mediums-of-exchange')
   * @param initFn The initialization function to execute
   * @returns Promise that resolves when initialization completes
   */
  async withLock<T>(domain: string, initFn: () => Promise<T>): Promise<T> {
    // If there's already an active lock for this domain, wait for it
    if (this.locks.has(domain)) {
      await this.locks.get(domain);
    }

    // If ANY domain is currently being initialized, wait for it to complete
    // This prevents source chain race conditions across different domains
    const activeLocks = Array.from(this.locks.values());
    if (activeLocks.length > 0) {
      await Promise.all(activeLocks);
    }

    // Create and store the new lock
    const lockPromise = this.executeWithLock(domain, initFn);
    this.locks.set(domain, lockPromise);

    try {
      return await lockPromise;
    } finally {
      // Clean up the lock when done
      this.locks.delete(domain);
    }
  }

  private async executeWithLock<T>(domain: string, initFn: () => Promise<T>): Promise<T> {
    console.log(`🔒 Acquiring initialization lock for domain: ${domain}`);
    try {
      const result = await initFn();
      console.log(`🔓 Released initialization lock for domain: ${domain}`);
      return result;
    } catch (error) {
      console.error(`❌ Initialization failed for domain ${domain}:`, error);
      throw error;
    }
  }

  /**
   * Check if any initialization is currently running
   */
  get isLocked(): boolean {
    return this.locks.size > 0;
  }

  /**
   * Get the currently locked domains
   */
  get lockedDomains(): string[] {
    return Array.from(this.locks.keys());
  }
}

// Global singleton instance
export const initializationLock = new InitializationLock();