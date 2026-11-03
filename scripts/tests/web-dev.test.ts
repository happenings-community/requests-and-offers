import { describe, expect, it } from 'bun:test';
import {
  appIdFor,
  hostFor,
  encodeToken,
  memberUrl,
  openCommand,
  parsePortList,
  parseWebDevConfig,
  sandboxCreateArgs,
  sandboxRunArgs,
  workdirFor
} from '../web-dev.mts';

describe('parseWebDevConfig', () => {
  it('defaults to two members on the usual UI port, with every other port picked at start', () => {
    expect(parseWebDevConfig({})).toEqual({
      agents: 2,
      uiPort: 8880,
      adminPort: undefined,
      bootstrapPort: undefined,
      inspectorPort: undefined
    });
  });

  it('reads AGENTS, UI_PORT, ADMIN_PORT and BOOTSTRAP_PORT', () => {
    expect(
      parseWebDevConfig({
        AGENTS: '3',
        UI_PORT: '8890',
        ADMIN_PORT: '56100',
        BOOTSTRAP_PORT: '56101',
        INSPECTOR_PORT: '56102'
      })
    ).toEqual({ agents: 3, uiPort: 8890, adminPort: 56100, bootstrapPort: 56101, inspectorPort: 56102 });
  });

  it('refuses a member count or a port that is not a usable number', () => {
    expect(() => parseWebDevConfig({ AGENTS: '0' })).toThrow(/AGENTS/);
    expect(() => parseWebDevConfig({ AGENTS: '27' })).toThrow(/AGENTS/);
    expect(() => parseWebDevConfig({ AGENTS: 'two' })).toThrow(/AGENTS/);
    expect(() => parseWebDevConfig({ UI_PORT: '70000' })).toThrow(/UI_PORT/);
    expect(() => parseWebDevConfig({ ADMIN_PORT: '-1' })).toThrow(/ADMIN_PORT/);
    expect(() => parseWebDevConfig({ INSPECTOR_PORT: 'x' })).toThrow(/INSPECTOR_PORT/);
  });
});

describe('appIdFor', () => {
  it('keeps the first member on the usual app id and letters the others', () => {
    expect([0, 1, 2, 25].map(appIdFor)).toEqual([
      'requests_and_offers',
      'requests_and_offers_b',
      'requests_and_offers_c',
      'requests_and_offers_z'
    ]);
  });
});

describe('memberUrl', () => {
  it('carries the three parameters HolochainClientService reads, the token URL-encoded', () => {
    const url = new URL(
      memberUrl({ host: 'localhost', uiPort: 8880, appPort: 41234, token: 'ab+/c==', adminPort: 56100 })
    );
    expect(url.origin).toBe('http://localhost:8880');
    expect(url.pathname).toBe('/');
    expect(url.searchParams.get('hcPort')).toBe('41234');
    expect(url.searchParams.get('hcToken')).toBe('ab+/c==');
    expect(url.searchParams.get('hcAdminPort')).toBe('56100');
  });
});

describe('hostFor', () => {
  it('puts the first two members on different origins, so their browser storage stays apart', () => {
    expect(hostFor(0)).toBe('localhost');
    expect(hostFor(1)).toBe('127.0.0.1');
    expect(hostFor(2)).toBe('localhost');
  });

  it('is the host of each member URL', () => {
    const url = new URL(
      memberUrl({ host: hostFor(1), uiPort: 8880, appPort: 1, token: 't', adminPort: 2 })
    );
    expect(url.origin).toBe('http://127.0.0.1:8880');
  });
});

describe('encodeToken', () => {
  it('encodes an app token the way HolochainClientService decodes it (atob, then char codes)', () => {
    const token = [0, 1, 127, 128, 255];
    const back = Array.from(atob(encodeToken(token)), (c) => c.charCodeAt(0));
    expect(back).toEqual(token);
  });
});

describe('sandbox commands', () => {
  it('creates one conductor whose only bootstrap is the local server, on the in-process transport', () => {
    expect(sandboxCreateArgs('/tmp/rao-web-56100', 'http://127.0.0.1:56101')).toEqual([
      'sandbox',
      '--piped',
      'create',
      '--root',
      '/tmp/rao-web-56100',
      'network',
      '-b',
      'http://127.0.0.1:56101',
      'mem'
    ]);
  });

  it('runs it on the chosen admin port, which must be set at run time', () => {
    expect(sandboxRunArgs(56100)).toEqual(['sandbox', '-f=56100', '--piped', 'run', '--all']);
  });

  it('keeps the sandbox under a short path, apart from the e2e suite and per admin port', () => {
    const dir = workdirFor(56100);
    expect(dir).toBe('/tmp/rao-web-56100');
    expect(dir).not.toBe('/tmp/rao-e2e');
    // lair's socket lives at <dir>/<id>/ks/socket and must fit in SUN_LEN.
    expect(dir.length).toBeLessThan(40);
  });
});

describe('openCommand', () => {
  it('opens a URL with the platform opener, or not at all where there is none', () => {
    expect(openCommand('linux')).toEqual(['xdg-open']);
    expect(openCommand('darwin')).toEqual(['open']);
    expect(openCommand('win32')).toEqual(['cmd', '/c', 'start', '']);
    expect(openCommand('aix')).toBeNull();
  });
});

describe('parsePortList', () => {
  it('reads the comma-separated admin ports bun start passes to hc-spin, in order', () => {
    expect(parsePortList('41001,41002')).toEqual([41001, 41002]);
    expect(parsePortList(' 41001 , 41002 ')).toEqual([41001, 41002]);
  });

  it('is empty when unset, and refuses anything that is not a port', () => {
    expect(parsePortList(undefined)).toEqual([]);
    expect(parsePortList('')).toEqual([]);
    expect(() => parsePortList('41001,x')).toThrow('ADMIN_PORTS');
    expect(() => parsePortList('70000')).toThrow('ADMIN_PORTS');
  });
});
