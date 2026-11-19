<script lang="ts">
  import type { Snippet } from 'svelte';
  import messagingPresence from '$lib/services/messagingPresence.svelte';
  import { MESSAGING_STRINGS as S } from '$lib/strings/messaging.strings';

  /**
   * The Messages screens, on a network that has messaging.
   *
   * A network without the messaging zome shows no way in, but a typed address or an old
   * link still lands here, and each of these pages reads the inbox as it mounts. Nothing
   * below this layout renders, so nothing calls a zome that is not there.
   */
  const { children }: { children: Snippet } = $props();
</script>

{#if messagingPresence.isAbsent}
  <section class="container mx-auto max-w-3xl p-6">
    <aside class="card variant-soft-surface p-4" data-testid="messaging-absent">
      {S.general.notOnThisNetwork}
    </aside>
  </section>
{:else}
  {@render children()}
{/if}
