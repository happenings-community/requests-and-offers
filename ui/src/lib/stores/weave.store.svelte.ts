import { Effect as E, pipe } from 'effect';
import type { AgentPubKey } from '@holochain/client';
import { encodeHashToBase64 } from '@holochain/client';
import type { Profile } from '@holochain-open-dev/profiles';
import type { WeaveClient } from '@theweave/api';
import type { ProfilesClient } from '@holochain-open-dev/profiles';
import {
  WeaveServiceTag,
  WeaveServiceLive,
  type MossProfile,
  type WeaveConnectionResult
} from '$lib/services/weave.service';
import { WeaveError } from '$lib/errors/weave.errors';
import { WEAVE_CONTEXTS } from '$lib/errors/error-contexts';
import type { UIUser } from '$lib/types/ui';

function createWeaveStore() {
  // Reactive state
  let isWeaveContext = $state(false);
  let mossProfile = $state<MossProfile | null>(null);
  let mossAvatarBlob = $state<Blob | null>(null);
  let isProgenitor = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let initialized = $state(false);

  // Internal references (non-reactive, stored from service)
  let weaveClient: WeaveClient | null = null;
  let profilesClient: ProfilesClient | null = null;

  // Derived state
  const hasMossNickname = $derived(isWeaveContext && !!mossProfile?.nickname);
  const hasMossAvatar = $derived(isWeaveContext && !!mossAvatarBlob);
  const mossNickname = $derived(mossProfile?.nickname ?? null);

  /**
   * Detect Weave context lazily. In `weave dev` mode, `initializeHotReload()`
   * must run before `isWeaveContext()` can detect the environment.
   * This is called by `detectWeaveContext()` which should be invoked after
   * `initializeHotReload()` in the layout's onMount.
   */
  function detectWeaveContext(): void {
    const detectEffect = pipe(
      E.gen(function* () {
        const service = yield* WeaveServiceTag;
        return service.isWeaveContext;
      }),
      E.provide(WeaveServiceLive),
      E.catchAll(() => E.succeed(false))
    );

    try {
      isWeaveContext = E.runSync(detectEffect);
    } catch {
      isWeaveContext = false;
    }
  }

  /**
   * Connect to Weave and return the connection result.
   * Called by HolochainClientService during connection setup.
   */
  function connect(): Promise<WeaveConnectionResult> {
    const effect = pipe(
      E.gen(function* () {
        const service = yield* WeaveServiceTag;
        const result = yield* service.connect();
        weaveClient = result.weaveClient;
        profilesClient = result.profilesClient;
        return result;
      }),
      E.provide(WeaveServiceLive)
    );

    return E.runPromise(effect);
  }

  /**
   * Decode a base64 avatar string into a Blob
   */
  function decodeAvatarBase64(base64: string): Blob | null {
    try {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Blob([bytes]);
    } catch {
      console.warn('Failed to decode avatar base64');
      return null;
    }
  }

  /**
   * Fetch the Moss profile for the given agent and populate reactive state.
   * Should be called after connection is established.
   */
  async function initialize(agentPubKey: AgentPubKey): Promise<void> {
    if (!isWeaveContext || !profilesClient) {
      initialized = true;
      return;
    }

    loading = true;
    error = null;

    try {
      const profileRecord = await profilesClient.getAgentProfile(agentPubKey);

      if (profileRecord) {
        const profile = profileRecord.entry as Profile;
        mossProfile = {
          nickname: profile.nickname,
          avatar: profile.fields?.avatar
        };

        if (mossProfile.avatar) {
          mossAvatarBlob = decodeAvatarBase64(mossProfile.avatar);
        }

        console.debug('🧶 Loaded Moss profile:', mossProfile.nickname);
      } else {
        mossProfile = null;
        mossAvatarBlob = null;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      error = `${WEAVE_CONTEXTS.GET_MOSS_PROFILE}: ${message}`;
      console.warn('Failed to fetch Moss profile:', e);
    } finally {
      loading = false;
      initialized = true;
    }
  }

  /**
   * Re-fetch the Moss profile (e.g., after profile update)
   */
  async function refreshMossProfile(agentPubKey: AgentPubKey): Promise<void> {
    if (!isWeaveContext || !profilesClient) return;

    try {
      const profileRecord = await profilesClient.getAgentProfile(agentPubKey);

      if (profileRecord) {
        const profile = profileRecord.entry as Profile;
        mossProfile = {
          nickname: profile.nickname,
          avatar: profile.fields?.avatar
        };

        if (mossProfile.avatar) {
          mossAvatarBlob = decodeAvatarBase64(mossProfile.avatar);
        } else {
          mossAvatarBlob = null;
        }
      } else {
        mossProfile = null;
        mossAvatarBlob = null;
      }
    } catch (e) {
      console.warn('Failed to refresh Moss profile:', e);
    }
  }

  /**
   * Merge Moss identity into a UIUser object.
   * Returns a new UIUser with Moss nickname/picture applied if available.
   */
  function enrichWithMossProfile(
    raoUser: UIUser | null,
    _agentPubKey: AgentPubKey
  ): E.Effect<UIUser | null, WeaveError> {
    return E.sync(() => {
      if (isWeaveContext && mossProfile) {
        let picture: Uint8Array | undefined;
        if (mossProfile.avatar) {
          try {
            const binaryString = atob(mossProfile.avatar);
            picture = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              picture[i] = binaryString.charCodeAt(i);
            }
          } catch {
            // Avatar conversion failed, continue without picture
          }
        }

        if (raoUser) {
          return {
            ...raoUser,
            nickname: mossProfile.nickname,
            picture,
            identitySource: 'moss' as const
          };
        }

        // Moss profile exists but no R&O user - return minimal UIUser
        // Hashes are not available in this code path; cast to satisfy type
        return {
          nickname: mossProfile.nickname,
          picture,
          name: '',
          bio: '',
          email: '',
          user_type: 'advocate' as const,
          identitySource: 'moss' as const
        } as unknown as UIUser;
      }

      if (!raoUser) {
        return null;
      }

      return {
        ...raoUser,
        identitySource: 'standalone' as const
      };
    });
  }

  /**
   * Check if the current agent is the Moss group progenitor (tool installer).
   * Updates the isProgenitor state.
   */
  async function checkProgenitor(myPubKey: AgentPubKey): Promise<boolean> {
    if (!isWeaveContext || !weaveClient) {
      isProgenitor = false;
      return false;
    }

    try {
      const renderInfo = weaveClient.renderInfo;
      if (renderInfo.type !== 'applet-view') {
        isProgenitor = false;
        return false;
      }

      const appletHash = renderInfo.appletHash;
      const installerPubKey = await weaveClient.toolInstaller(appletHash);

      if (!installerPubKey) {
        isProgenitor = false;
        return false;
      }

      const installerB64 = encodeHashToBase64(installerPubKey);
      const myB64 = encodeHashToBase64(myPubKey);
      isProgenitor = installerB64 === myB64;

      console.debug(
        `🔍 isGroupProgenitor: ${isProgenitor ? 'Current agent IS the tool installer (progenitor)' : 'Current agent is NOT the tool installer'}`
      );

      return isProgenitor;
    } catch (e) {
      console.warn('Failed to check progenitor status:', e);
      isProgenitor = false;
      return false;
    }
  }

  return {
    // Reactive getters
    get isWeaveContext() {
      return isWeaveContext;
    },
    get mossProfile() {
      return mossProfile;
    },
    get mossAvatarBlob() {
      return mossAvatarBlob;
    },
    get isProgenitor() {
      return isProgenitor;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get initialized() {
      return initialized;
    },

    // Derived getters
    get hasMossNickname() {
      return hasMossNickname;
    },
    get hasMossAvatar() {
      return hasMossAvatar;
    },
    get mossNickname() {
      return mossNickname;
    },

    // Methods
    detectWeaveContext,
    connect,
    initialize,
    refreshMossProfile,
    enrichWithMossProfile,
    checkProgenitor,
    decodeAvatarBase64
  };
}

const weaveStore = createWeaveStore();
export default weaveStore;
