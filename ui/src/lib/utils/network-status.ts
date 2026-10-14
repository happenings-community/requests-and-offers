/**
 * Pure helpers for turning conductor network data into a connection state.
 *
 * Kept free of Svelte and Holochain client imports so they can be unit
 * tested without mocking either.
 */

export type NetworkConnectionState = 'offline' | 'alone' | 'connected';

export interface NetworkSignals {
  /** What the OS reports. navigator.onLine in a browser or Electron. */
  online: boolean;
  /** Live transport connections to other peers, from dumpNetworkStats. */
  reachable: number;
}

/**
 * Derive the headline state.
 *
 * offline: the OS says there is no network. Nothing else matters.
 * alone: online, but no other peer is reachable right now.
 * connected: at least one peer reachable.
 *
 * The conductor cannot tell us it is isolated: its own view of its reachable
 * addresses is cached, not live. The OS can, so that is the source for offline.
 */
export function deriveConnectionStatus(signals: NetworkSignals): NetworkConnectionState {
  if (signals.online === false) return 'offline';
  if (signals.reachable <= 0) return 'alone';
  return 'connected';
}

/** Shape of the inner JSON in each agentInfo string from the conductor. */
export interface ParsedAgentInfo {
  agent?: string;
  space?: string;
  expiresAt?: string;
  isTombstone?: boolean;
}

/**
 * Parse one agentInfo string. The conductor returns each as JSON whose
 * agentInfo field is itself a JSON string. Returns null on anything malformed.
 */
export function parseAgentInfo(raw: string): ParsedAgentInfo | null {
  try {
    const outer = JSON.parse(raw);
    const inner = typeof outer?.agentInfo === 'string' ? JSON.parse(outer.agentInfo) : outer;
    if (inner === null || typeof inner !== 'object') return null;
    return inner as ParsedAgentInfo;
  } catch {
    return null;
  }
}

/**
 * Count other peers this node knows about.
 *
 * The list from agentInfo has one entry per agent per DNA, so a two-agent app
 * with two DNAs yields four entries. Deduplicating by agent key gives the
 * number of distinct agents regardless of how many DNAs they appear in.
 * Tombstoned and expired entries are agents that have left, so they are
 * dropped. The local agent is always present once, hence the subtraction.
 */
export function countKnownPeers(rawAgentInfos: string[], now: Date = new Date()): number {
  const agents = new Set<string>();
  const nowMs = now.getTime();

  for (const raw of rawAgentInfos) {
    const info = parseAgentInfo(raw);
    if (info === null || typeof info.agent !== 'string') continue;
    if (info.isTombstone === true) continue;
    if (typeof info.expiresAt === 'string') {
      const expires = Number(info.expiresAt);
      // Kitsune2 timestamps are microseconds; treat as expired if in the past.
      if (Number.isFinite(expires) && expires / 1000 < nowMs) continue;
    }
    agents.add(info.agent);
  }

  return Math.max(0, agents.size - 1);
}
