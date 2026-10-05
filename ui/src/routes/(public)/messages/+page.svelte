<script lang="ts">
  import { useMessages, FILTERS } from '$lib/composables/domain/messaging/useMessages.svelte';
  import ConversationRow from '$lib/components/messaging/ConversationRow.svelte';
  import FaultRow from '$lib/components/messaging/FaultRow.svelte';
  import { MESSAGING_STRINGS as S } from '$lib/strings/messaging.strings';
  import { encodeHashToBase64 } from '@holochain/client';
  import messagingStore from '$lib/stores/messaging.store.svelte';
  import type { ThreadFilter } from '$lib/utils/messaging-threads';

  const messages = useMessages();

  $effect(() => {
    messages.initialize();
  });

  /**
   * Faults sit with the conversations rather than in their own section, because they are
   * something that arrived for you and wants attention, which is what this list is. They
   * are hidden under every filter but All: a fault has no listing type, no exchange and
   * no unread count, so it would be a stray row under any of the others.
   */
  const showFaults = $derived(messages.filter === 'all');

  /** Read once, then owned by the checkbox: the store is the record, this is the view. */
  let sendReceipts = $state(true);
  $effect(() => {
    sendReceipts = messagingStore.receiptsOverall();
  });
</script>

<svelte:head><title>{S.messages.title}</title></svelte:head>

<section class="container mx-auto flex max-w-4xl flex-col gap-5 p-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div class="flex flex-col gap-1">
      <h1 class="h1">{S.messages.title}</h1>
      <p class="text-surface-500">{S.messages.intro}</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <label class="flex items-center gap-2 text-sm">
        <span class="text-surface-500 font-semibold">{S.messages.filter.label}</span>
        <select
          class="select-sm select w-auto"
          value={messages.filter}
          onchange={(e) => messages.setFilter(e.currentTarget.value as ThreadFilter)}
          data-testid="show-filter"
        >
          {#each FILTERS as f (f.key)}
            <option value={f.key}>{S.messages.filter[f.key]}</option>
          {/each}
        </select>
      </label>
      <a class="btn btn-sm variant-ghost" href="/messages/blocked">{S.messages.blocked.button}</a>
    </div>
  </div>

  <aside class="card border-warning-500 bg-warning-50 dark:bg-warning-900/20 border border-dashed p-3">
    <p class="text-sm">{S.messages.privacy}</p>
  </aside>

  <!--
    The overall setting. Each conversation can override it, and the ones left alone
    follow it. The note is here rather than in a tooltip because it is the one thing a
    member might otherwise assume wrongly.
  -->
  <aside class="card flex flex-col gap-1 p-3">
    <label class="flex items-center gap-2">
      <input
        type="checkbox"
        class="checkbox"
        checked={sendReceipts}
        onchange={(e) => {
          sendReceipts = e.currentTarget.checked;
          messagingStore.setReceiptsOverall(sendReceipts);
        }}
        data-testid="send-receipts"
      />
      <span class="font-semibold">{S.settings.sendReceipts}</span>
    </label>
    <p class="text-surface-500 text-sm">{S.settings.sendReceiptsNote}</p>
  </aside>

  {#if messages.error}
    <aside class="card variant-soft-error p-4" role="alert">{messages.error}</aside>
  {/if}

  {#if messages.loading && messages.threads.length === 0}
    <p class="text-surface-500">Loading…</p>
  {:else}
    <div class="flex flex-col gap-2.5">
      {#if showFaults}
        {#each messages.faults as fault (encodeHashToBase64(fault.hash))}
          <FaultRow {fault} name={messages.nameOfAgent(encodeHashToBase64(fault.from))} />
        {/each}
      {/if}

      {#each messages.shown as thread (thread.key)}
        <ConversationRow
          {thread}
          name={messages.nameOf(thread)}
          onArchive={messages.setArchived}
        />
      {/each}

      {#if messages.shown.length === 0 && !(showFaults && messages.faults.length > 0)}
        {#if messages.threads.length === 0}
          <div class="card flex flex-col gap-2 p-8 text-center">
            <h2 class="h4">{S.messages.empty.title}</h2>
            <p class="text-surface-500">{S.messages.empty.body}</p>
          </div>
        {:else}
          <p class="text-surface-500 p-8 text-center">{S.messages.empty.filtered}</p>
        {/if}
      {/if}
    </div>
  {/if}
</section>
