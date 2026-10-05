<script lang="ts">
  import { encodeHashToBase64 } from '@holochain/client';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import type { UIThread } from '$lib/utils/messaging-threads';

  type Props = {
    thread: UIThread;
    name: string;
    onArchive: (thread: UIThread, archived: boolean) => void;
  };
  const { thread, name, onArchive }: Props = $props();

  const href = $derived(`/messages/${encodeHashToBase64(thread.counterparty)}`);
  const initial = $derived(name.trim().charAt(0).toUpperCase() || '?');

  /** The newest message, which is what the row previews. */
  const last = $derived(thread.messages.at(-1));
  const when = $derived(
    thread.lastAt ? new Date(thread.lastAt).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : ''
  );

  /**
   * One chip per listing type in this conversation, not one per card.
   *
   * A conversation with four offers from the same person is still "about offers"; four
   * identical chips would say nothing the first one did not. Gold is Requests and orange
   * is Offers, never swapped.
   */
  const kinds = $derived.by(() => {
    const out: { label: string; variant: string }[] = [];
    const types = new Set([
      ...thread.interests.map((i) => i.listing_type),
      ...thread.exchanges.map((e) => e.agreement.listing_type)
    ]);
    if (types.has('Offer')) out.push({ label: '\u{1F4A1} Offer', variant: 'variant-soft-warning' });
    if (types.has('Request'))
      out.push({ label: '\u{1F4DD} Request', variant: 'variant-soft-secondary' });
    if (thread.exchanges.length > 0)
      out.push({ label: '\u{1F91D} Exchange', variant: 'variant-soft-primary' });
    return out;
  });
</script>

<div class="card flex items-start gap-4 p-4 transition-colors hover:bg-surface-100 dark:hover:bg-surface-700">
  <a {href} class="flex min-w-0 flex-1 items-start gap-4 no-underline" data-testid="conversation-row">
    <span
      aria-hidden="true"
      class="bg-primary-100 text-primary-800 flex h-11 w-11 flex-none items-center justify-center rounded-full text-lg font-bold"
      >{initial}</span
    >
    <div class="flex min-w-0 flex-1 flex-col gap-1.5">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-semibold">{name}</span>
        {#if thread.unread > 0}
          <span class="variant-filled-primary badge" data-testid="unread-count"
            >{fill(S.hub.new, { count: thread.unread })}</span
          >
        {/if}
        <span class="text-surface-500 ml-auto text-sm">{when}</span>
      </div>
      {#if kinds.length > 0}
        <div class="flex flex-wrap gap-1.5">
          {#each kinds as kind (kind.label)}
            <span class="badge {kind.variant}">{kind.label}</span>
          {/each}
        </div>
      {/if}
      {#if last}
        <p class="text-surface-600 dark:text-surface-300 truncate text-sm">
          {#if last.mine}<span class="font-medium">{S.messages.youPrefix}</span>{/if}
          {last.content}
        </p>
      {/if}
    </div>
  </a>
  <button
    type="button"
    class="btn btn-sm variant-ghost shrink-0"
    onclick={() => onArchive(thread, !thread.archived)}
  >
    {thread.archived ? S.messages.unarchive : S.messages.archive}
  </button>
</div>
