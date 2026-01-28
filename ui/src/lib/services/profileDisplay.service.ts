import { Effect as E, Context, Layer, pipe } from 'effect';
import type { AgentPubKey } from '@holochain/client';
import type { Profile } from '@holochain-open-dev/profiles';
import { ProfileDisplayError } from '$lib/errors/profile-display.errors';
import hc from './HolochainClientService.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import { runEffect } from '$lib/utils/effect';

export interface MossProfile {
  nickname: string;
  avatar?: string;
}

export interface DisplayProfile {
  nickname: string;
  picture?: Uint8Array;
  name?: string;
  bio?: string;
  email?: string;
  phone?: string;
  time_zone?: string;
  location?: string;
  user_type?: 'creator' | 'advocate';
  identitySource: 'moss' | 'standalone';
}

export interface ProfileDisplayService {
  readonly getDisplayProfile: (agentPubKey: AgentPubKey) => E.Effect<DisplayProfile | null, ProfileDisplayError>;
  readonly getMossProfile: (agentPubKey: AgentPubKey) => E.Effect<MossProfile | null, ProfileDisplayError>;
  readonly isWeaveContext: () => boolean;
}

export class ProfileDisplayServiceTag extends Context.Tag('ProfileDisplayService')<
  ProfileDisplayServiceTag,
  ProfileDisplayService
>() {}

const PROFILE_DISPLAY_CONTEXTS = {
  GET_MOSS_PROFILE: 'Failed to get Moss profile',
  GET_DISPLAY_PROFILE: 'Failed to get display profile'
};

const makeProfileDisplayService = E.sync(() => {
  const isWeaveContext = (): boolean => hc.isWeaveContext;

  const getMossProfile = (agentPubKey: AgentPubKey): E.Effect<MossProfile | null, ProfileDisplayError> =>
    E.gen(function* () {
      if (!hc.isWeaveContext || !hc.profilesClient) {
        yield* E.logInfo('Not in Weave context, no Moss profile available');
        return null;
      }

      yield* E.logInfo('Fetching Moss profile via profilesClient');

      const profileRecord = yield* E.tryPromise({
        try: () => hc.profilesClient!.getAgentProfile(agentPubKey),
        catch: (error) =>
          ProfileDisplayError.fromError(error, PROFILE_DISPLAY_CONTEXTS.GET_MOSS_PROFILE, agentPubKey.toString())
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

  const getDisplayProfile = (agentPubKey: AgentPubKey): E.Effect<DisplayProfile | null, ProfileDisplayError> =>
    E.gen(function* () {
      yield* E.logInfo('Getting display profile for agent');

      const raoUser = yield* pipe(
        E.tryPromise({
          try: () => runEffect(usersStore.getUserByAgentPubKey(agentPubKey)),
          catch: (error) =>
            ProfileDisplayError.fromError(error, PROFILE_DISPLAY_CONTEXTS.GET_DISPLAY_PROFILE, agentPubKey.toString())
        }),
        E.catchAll(() => E.succeed(null))
      );

      if (hc.isWeaveContext) {
        const mossProfile = yield* getMossProfile(agentPubKey);

        if (mossProfile) {
          yield* E.logInfo('Merging Moss identity with R&O extended data');

          let picture: Uint8Array | undefined;
          if (mossProfile.avatar) {
            try {
              const binaryString = atob(mossProfile.avatar);
              picture = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                picture[i] = binaryString.charCodeAt(i);
              }
            } catch {
              // Conversion failed
            }
          }

          return {
            nickname: mossProfile.nickname,
            picture,
            name: raoUser?.name,
            bio: raoUser?.bio,
            email: raoUser?.email,
            phone: raoUser?.phone,
            time_zone: raoUser?.time_zone,
            location: raoUser?.location,
            user_type: raoUser?.user_type,
            identitySource: 'moss' as const
          };
        }
      }

      if (!raoUser) {
        yield* E.logInfo('No profile data found');
        return null;
      }

      yield* E.logInfo('Using standalone R&O profile');

      return {
        nickname: raoUser.nickname,
        picture: raoUser.picture,
        name: raoUser.name,
        bio: raoUser.bio,
        email: raoUser.email,
        phone: raoUser.phone,
        time_zone: raoUser.time_zone,
        location: raoUser.location,
        user_type: raoUser.user_type,
        identitySource: 'standalone' as const
      };
    });

  return {
    getDisplayProfile,
    getMossProfile,
    isWeaveContext
  };
});

export const ProfileDisplayServiceLive: Layer.Layer<ProfileDisplayServiceTag> = Layer.effect(
  ProfileDisplayServiceTag,
  makeProfileDisplayService
);

export function useProfileDisplay() {
  return {
    get isWeaveContext() {
      return hc.isWeaveContext;
    }
  };
}
