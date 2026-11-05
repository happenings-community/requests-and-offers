import { describe, expect, it } from 'bun:test';
import { pointWrapperAt } from '../release-wrapper.ts';

// The head of the wrapper's config as kangaroo #10 leaves it: the version is
// already the release's, and there is no webhapp block yet.
const wrapperConfig = `import { defineConfig } from './src/main/defineConfig';

export default defineConfig({
  appId: 'requests-and-offers.happenings-community.kangaroo-electron',
  productName: 'Requests and Offers',
  version: '0.6.0-alpha.2',
  macOSCodeSigning: false,
  networkSeed: 'alpha2-holochain07-2026',
  bins: {
    holochainVersion: '0.7.0',
  },
});
`;

const target = {
  version: '0.6.0-alpha.2',
  url: 'https://github.com/happenings-community/requests-and-offers/releases/download/v0.6.0-alpha.2/requests_and_offers.webhapp',
  sha256: 'a'.repeat(64),
};

describe('pointWrapperAt', () => {
  it('adds the webhapp block when the wrapper already carries the version', () => {
    const { source, changed } = pointWrapperAt(wrapperConfig, target);
    expect(changed).toBe(true);
    expect(source).toContain(
      `  version: '0.6.0-alpha.2',\n  webhapp: {\n    url: '${target.url}',\n    sha256: '${target.sha256}',\n  },\n  macOSCodeSigning`
    );
  });

  it('reports nothing changed on a second run instead of failing', () => {
    const once = pointWrapperAt(wrapperConfig, target).source;
    const twice = pointWrapperAt(once, target);
    expect(twice.changed).toBe(false);
    expect(twice.source).toBe(once);
  });

  it('replaces the version and an earlier release in place', () => {
    const earlier = pointWrapperAt(wrapperConfig.replace("'0.6.0-alpha.2'", "'0.6.0-alpha.1'"), {
      ...target,
      version: '0.6.0-alpha.1',
      sha256: 'b'.repeat(64),
    }).source;
    const { source } = pointWrapperAt(earlier, target);
    expect(source).toContain("version: '0.6.0-alpha.2'");
    expect(source).not.toContain('b'.repeat(64));
    expect(source.match(/webhapp:/g)).toHaveLength(1);
  });

  it('never touches holochainVersion', () => {
    const { source } = pointWrapperAt(wrapperConfig, { ...target, version: '9.9.9' });
    expect(source).toContain("holochainVersion: '0.7.0'");
  });

  it('fails only on a config with no version field', () => {
    expect(() => pointWrapperAt("export default defineConfig({\n  appId: 'x',\n});\n", target)).toThrow(
      /no `version/
    );
  });
});
