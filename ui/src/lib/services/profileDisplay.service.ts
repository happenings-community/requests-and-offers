import { Effect as E, Context, Layer } from 'effect';
import type { AgentPubKey } from '@holochain/client';
import type { Profile } from '@holochain-open-dev/profiles';
import { ProfileDisplayError } from '$lib/errors/profile-display.errors';
import { PROFILE_DISPLAY_CONTEXTS } from '$lib/errors/error-contexts';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import type { UIUser } from '$lib/types/ui';

export interface MossProfile {
  nickname: string;
  avatar?: string;
}

export interface ProfileDisplayService {
  readonly enrichWithMossProfile: (
    raoUser: UIUser | null,
    agentPubKey: AgentPubKey
  ) => E.Effect<UIUser | null, ProfileDisplayError>;
  readonly getMossProfile: (
    agentPubKey: AgentPubKey
  ) => E.Effect<MossProfile | null, ProfileDisplayError>;
}

export class ProfileDisplayServiceTag extends Context.Tag('ProfileDisplayService')<
  ProfileDisplayServiceTag,
  ProfileDisplayService
>() {}

export const ProfileDisplayServiceLive: Layer.Layer<
  ProfileDisplayServiceTag,
  never,
  HolochainClientServiceTag
> = Layer.effect(
  ProfileDisplayServiceTag,
  E.gen(function* () {
    const holochainClient = yield* HolochainClientServiceTag;

    const getMossProfile = (
      agentPubKey: AgentPubKey
    ): E.Effect<MossProfile | null, ProfileDisplayError> =>
      E.gen(function* () {
        if (!holochainClient.isWeaveContext || !holochainClient.profilesClient) {
          yield* E.logInfo('Not in Weave context, no Moss profile available');
          return null;
        }

        yield* E.logInfo('Fetching Moss profile via profilesClient');

        const profileRecord = yield* E.tryPromise({
          try: () => holochainClient.profilesClient!.getAgentProfile(agentPubKey),
          catch: (error) =>
            ProfileDisplayError.fromError(
              error,
              PROFILE_DISPLAY_CONTEXTS.GET_MOSS_PROFILE,
              agentPubKey.toString()
            )
        });

        if (!profileRecord) {
          yield* E.logInfo('No Moss profile found for agent');
          return null;
        }

        const profile = profileRecord.entry as Profile;
        yield* E.logInfo('Moss profile found: ' + profile.nickname);

        return {
          nickname: profile.nickname,
          avatar: profile.fields?.avatar
        };
      });

    const enrichWithMossProfile = (
      raoUser: UIUser | null,
      agentPubKey: AgentPubKey
    ): E.Effect<UIUser | null, ProfileDisplayError> =>
      E.gen(function* () {
        if (holochainClient.isWeaveContext) {
          const mossProfile = yield* getMossProfile(agentPubKey);

          if (mossProfile) {
            yield* E.logInfo('Merging Moss identity with R&O data');

            let picture: Uint8Array | undefined;
            if (mossProfile.avatar) {
              try {
                const binaryString = atob(mossProfile.avatar);
                picture = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  picture[i] = binaryString.charCodeAt(i);
                }
              } catch {
                // Avatar base64 conversion failed, continue without picture
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

            // Moss profile exists but no R&O user — return minimal UIUser
            return {
              nickname: mossProfile.nickname,
              picture,
              name: '',
              bio: '',
              email: '',
              user_type: 'advocate' as const,
              identitySource: 'moss' as const
            };
          }
        }

        if (!raoUser) {
          return null;
        }

        return {
          ...raoUser,
          identitySource: 'standalone' as const
        };
      });

    return { enrichWithMossProfile, getMossProfile };
  })
);
