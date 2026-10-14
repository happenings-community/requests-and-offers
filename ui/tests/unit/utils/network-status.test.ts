import { describe, it, expect } from 'vitest';
import {
  deriveConnectionStatus,
  parseAgentInfo,
  countKnownPeers
} from '../../../src/lib/utils/network-status';

describe('deriveConnectionStatus', () => {
  it('is offline when the OS reports no network, whatever the peer count', () => {
    expect(deriveConnectionStatus({ online: false, reachable: 0 })).toBe('offline');
    expect(deriveConnectionStatus({ online: false, reachable: 3 })).toBe('offline');
  });

  it('is alone when online with no reachable peers', () => {
    expect(deriveConnectionStatus({ online: true, reachable: 0 })).toBe('alone');
  });

  it('is connected when online with at least one reachable peer', () => {
    expect(deriveConnectionStatus({ online: true, reachable: 1 })).toBe('connected');
    expect(deriveConnectionStatus({ online: true, reachable: 12 })).toBe('connected');
  });
});

// Build an agentInfo string the way the conductor returns them: outer JSON
// whose agentInfo field is itself a JSON string.
function agentInfoString(inner: Record<string, unknown>): string {
  return JSON.stringify({ agentInfo: JSON.stringify(inner), signature: 'sig' });
}

describe('parseAgentInfo', () => {
  it('unwraps the double-encoded shape', () => {
    const raw = agentInfoString({ agent: 'A', space: 'S' });
    expect(parseAgentInfo(raw)).toEqual({ agent: 'A', space: 'S' });
  });

  it('accepts an already-flat object', () => {
    expect(parseAgentInfo(JSON.stringify({ agent: 'A' }))).toEqual({ agent: 'A' });
  });

  it('returns null for malformed input', () => {
    expect(parseAgentInfo('not json')).toBeNull();
    expect(parseAgentInfo(JSON.stringify({ agentInfo: 'not json' }))).toBeNull();
    expect(parseAgentInfo('null')).toBeNull();
  });
});

describe('countKnownPeers', () => {
  const far = String(Date.now() * 1000 + 60 * 60 * 1_000_000); // an hour ahead, microseconds

  it('counts distinct agents minus self, across DNAs', () => {
    // Two agents, each in two DNAs: four entries, two agents, one other peer.
    const infos = [
      agentInfoString({ agent: 'me', space: 'dna1', expiresAt: far }),
      agentInfoString({ agent: 'me', space: 'dna2', expiresAt: far }),
      agentInfoString({ agent: 'bob', space: 'dna1', expiresAt: far }),
      agentInfoString({ agent: 'bob', space: 'dna2', expiresAt: far })
    ];
    expect(countKnownPeers(infos)).toBe(1);
  });

  it('is zero when only the local agent is present', () => {
    expect(countKnownPeers([agentInfoString({ agent: 'me', expiresAt: far })])).toBe(0);
  });

  it('is zero for an empty list', () => {
    expect(countKnownPeers([])).toBe(0);
  });

  it('drops tombstoned agents', () => {
    const infos = [
      agentInfoString({ agent: 'me', expiresAt: far }),
      agentInfoString({ agent: 'gone', expiresAt: far, isTombstone: true })
    ];
    expect(countKnownPeers(infos)).toBe(0);
  });

  it('drops expired agents', () => {
    const past = String(1_000_000); // early 1970, microseconds
    const infos = [
      agentInfoString({ agent: 'me', expiresAt: far }),
      agentInfoString({ agent: 'stale', expiresAt: past })
    ];
    expect(countKnownPeers(infos)).toBe(0);
  });

  it('ignores entries it cannot parse', () => {
    const infos = [agentInfoString({ agent: 'me', expiresAt: far }), 'garbage', agentInfoString({ agent: 'bob', expiresAt: far })];
    expect(countKnownPeers(infos)).toBe(1);
  });
});
