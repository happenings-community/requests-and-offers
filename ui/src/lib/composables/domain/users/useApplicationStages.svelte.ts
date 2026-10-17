import { encodeHashToBase64 } from '@holochain/client';
import usersStore from '$lib/stores/users.store.svelte';
import type { UIUser } from '$lib/types/ui';
import { runEffect } from '$lib/utils/effect';
import { applicationStage, type ApplicationStage } from '$lib/utils/application-stage';

/**
 * The stage of each pending application in the admin queue (#331).
 *
 * Each pending user is re-read from their latest profile record, which carries both
 * the profile's last edit time and the latest status with its own time. A user that
 * won't read keeps no stage rather than a guessed one.
 */
export function useApplicationStages() {
  let stages = $state<Record<string, ApplicationStage>>({});

  async function refresh(users: readonly UIUser[]): Promise<void> {
    const next: Record<string, ApplicationStage> = {};
    await Promise.all(
      users.map(async (user) => {
        if (!user.original_action_hash) return;
        try {
          const latest = await runEffect(usersStore.getLatestUser(user.original_action_hash));
          const stage = applicationStage(latest?.status, latest?.updated_at);
          if (stage) next[encodeHashToBase64(user.original_action_hash)] = stage;
        } catch {
          // Unreadable for now: no label until the next refresh.
        }
      })
    );
    stages = next;
  }

  function stageOf(user: UIUser): ApplicationStage | undefined {
    return user.original_action_hash
      ? stages[encodeHashToBase64(user.original_action_hash)]
      : undefined;
  }

  return { refresh, stageOf };
}
