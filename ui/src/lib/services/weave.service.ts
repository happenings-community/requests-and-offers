import { Effect as E, Context, Layer } from 'effect';
import { isWeaveContext, WeaveClient } from '@theweave/api';
import type { ProfilesClient } from '@holochain-open-dev/profiles';
import type { AppClient } from '@holochain/client';
import { WeaveError } from '$lib/errors/weave.errors';
import { WEAVE_CONTEXTS } from '$lib/errors/error-contexts';

export interface MossProfile {
  nickname: string;
  avatar?: string;
}

export interface WeaveConnectionResult {
  appClient: AppClient;
  weaveClient: WeaveClient;
  profilesClient: ProfilesClient;
}

export interface WeaveService {
  readonly isWeaveContext: boolean;
  readonly connect: () => E.Effect<WeaveConnectionResult, WeaveError>;
  readonly getWeaveClient: () => WeaveClient | null;
  readonly getProfilesClient: () => ProfilesClient | null;
}

export class WeaveServiceTag extends Context.Tag('WeaveService')<WeaveServiceTag, WeaveService>() {}

function createWeaveService(): WeaveService {
  let weaveClient: WeaveClient | null = null;
  let profilesClient: ProfilesClient | null = null;
  let detectedWeaveContext: boolean | null = null;

  /**
   * Lazily detect Weave context. This must NOT run at module import time
   * because in `weave dev` mode, `initializeHotReload()` sets up
   * `window.__WEAVE_API__` which `isWeaveContext()` checks.
   * If called too early, `window.__WEAVE_API__` won't exist yet.
   */
  function detectContext(): boolean {
    if (detectedWeaveContext === null) {
      try {
        detectedWeaveContext = isWeaveContext();
      } catch {
        detectedWeaveContext = false;
      }
    }
    return detectedWeaveContext;
  }

  const connect = (): E.Effect<WeaveConnectionResult, WeaveError> =>
    E.gen(function* () {
      if (!detectContext()) {
        return yield* E.fail(WeaveError.create('Not in Weave context', WEAVE_CONTEXTS.CONNECT));
      }

      const client = yield* E.tryPromise({
        try: () => WeaveClient.connect(),
        catch: (error) => WeaveError.fromError(error, WEAVE_CONTEXTS.CONNECT)
      });

      if (client.renderInfo.type !== 'applet-view') {
        return yield* E.fail(
          WeaveError.create('Cross-group views not yet implemented', WEAVE_CONTEXTS.CONNECT)
        );
      }

      weaveClient = client;
      profilesClient = client.renderInfo.profilesClient;

      return {
        appClient: client.renderInfo.appletClient,
        weaveClient: client,
        profilesClient: client.renderInfo.profilesClient
      };
    });

  return {
    get isWeaveContext() {
      return detectContext();
    },
    connect,
    getWeaveClient: () => weaveClient,
    getProfilesClient: () => profilesClient
  };
}

export const WeaveServiceLive: Layer.Layer<WeaveServiceTag> = Layer.succeed(
  WeaveServiceTag,
  createWeaveService()
);
