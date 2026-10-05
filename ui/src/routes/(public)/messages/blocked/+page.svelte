<script lang="ts">
  import { decodeHashFromBase64, type ActionHash } from '@holochain/client';
  import messagingStore from '$lib/stores/messaging.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';

  /**
   * Who is blocked, and everything that led there.
   *
   * **This page is the protection against a block being silently forgotten.** Blocks
   * live in local storage now, which clearing site data wipes, so a member needs
   * somewhere to see what is in force rather than discovering it when someone they
   * blocked reappears.
   */
  let names = $state<Record<string, string>>({});
  let loading = $state(true);

  const blocked = $derived(messagingStore.blockedUsers());
  // Newest first: the most recent change is the one a member came here to check.
  const history = $derived([...messagingStore.blockHistory()].reverse());

  const hashOf = (b64: string): ActionHash | null => {
    try {
      return decodeHashFromBase64(b64) as ActionHash;
    } catch {
      return null;
    }
  };

  const nameOf = (b64: string) => names[b64] ?? 'A member';

  async function resolve() {
    loading = true;
    const keys = new Set([...blocked, ...history.map((h) => h.user)]);
    for (const key of keys) {
      if (key in names) continue;
      const hash = hashOf(key);
      const user = hash ? await runEffect(usersStore.getUserByActionHash(hash)) : null;
      names[key] = user?.name ?? 'A member';
    }
    loading = false;
  }

  $effect(() => {
    messagingStore.loadConversations();
    resolve();
  });

  const when = (at: number) =>
    new Date(at).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  function unblock(b64: string) {
    const hash = hashOf(b64);
    if (hash) messagingStore.setBlocked(hash, false);
  }
</script>

<svelte:head><title>{S.blocked.title}</title></svelte:head>

<section class="container mx-auto flex max-w-3xl flex-col gap-5 p-4">
  <a class="text-surface-500 text-sm no-underline" href="/messages">← {S.conversation.back}</a>
  <h1 class="h1">{S.blocked.title}</h1>

  <div class="flex flex-col gap-2">
    <h2 class="h4">{S.blocked.now}</h2>
    {#if loading && blocked.length === 0}
      <p class="text-surface-500">Loading…</p>
    {:else if blocked.length === 0}
      <p class="text-surface-500">{S.blocked.empty}</p>
    {:else}
      <ul class="flex flex-col gap-2">
        {#each blocked as key (key)}
          <li class="card flex flex-wrap items-center gap-3 p-3">
            <span class="font-semibold">{nameOf(key)}</span>
            <button
              type="button"
              class="btn btn-sm variant-ghost ml-auto"
              onclick={() => unblock(key)}>{S.block.unblock}</button
            >
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if history.length > 0}
    <div class="flex flex-col gap-2">
      <h2 class="h4">{S.blocked.history}</h2>
      <ul class="flex flex-col gap-1 text-sm">
        {#each history as event, i (`${event.user}-${event.at}-${i}`)}
          <li class="text-surface-600 dark:text-surface-300 flex flex-wrap gap-2">
            <span class="font-medium">{nameOf(event.user)}</span>
            <span>{event.blocked ? S.block.button.toLowerCase() : S.block.unblock.toLowerCase()}</span>
            <span class="text-surface-500 ml-auto">{when(event.at)}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>
