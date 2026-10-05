<script lang="ts">
  import { page } from '$app/stores';
  import { encodeHashToBase64 } from '@holochain/client';
  import { useConversation } from '$lib/composables/domain/messaging/useConversation.svelte';
  import OpeningCard from '$lib/components/messaging/OpeningCard.svelte';
  import ProposalCard from '$lib/components/messaging/ProposalCard.svelte';
  import AgreementLine from '$lib/components/messaging/AgreementLine.svelte';
  import ProposalPicker from '$lib/components/messaging/ProposalPicker.svelte';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import usersStore from '$lib/stores/users.store.svelte';
  import {
    bytesLeft,
    isTooLong,
    messagesNeeded,
    percentOver,
    percentUsed,
    showsAsAgreement
  } from '$lib/utils/messaging-threads';

  // The route is `[user]`, so SvelteKit always has it here; the fallback keeps the type
  // honest rather than asserting non-null.
  const conversation = useConversation($page.params.user ?? '');
  const me = $derived(usersStore.currentUser?.original_action_hash);

  $effect(() => {
    conversation.initialize();
  });


  let picking = $state(false);

  /**
   * The composer's byte budget.
   *
   * **Bytes, not characters**, because that is what the zome measures: `content.len()`
   * in Rust is the UTF-8 byte length. A character count would let someone writing with
   * accents or emoji fill the budget while the counter still showed room, and they would
   * find out only when the send was refused.
   *
   * The counter shows only near the end. Sitting there from the first character turns
   * writing a message into filling in a form.
   */
  const left = $derived(bytesLeft(conversation.draft));
  const tooLong = $derived(left < 0);
  const showCounter = $derived(left <= 500);
  const used = $derived(percentUsed(conversation.draft));
  const over = $derived(percentOver(conversation.draft));
  const pieces = $derived(messagesNeeded(conversation.draft));

  const whenOf = (at: number) =>
    new Date(at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' });
</script>

<svelte:head><title>{conversation.name}</title></svelte:head>

<section class="container mx-auto flex max-w-3xl flex-col gap-4 p-4">
  <a class="text-surface-500 text-sm no-underline" href="/messages">← {S.conversation.back}</a>

  <header class="flex flex-col gap-1">
    <h1 class="h2">{conversation.name}</h1>
    <p class="text-surface-500 text-sm">{fill(S.conversation.subtitle, { name: conversation.name })}</p>
  </header>

  <div class="flex flex-col gap-3" data-testid="timeline">
    {#each conversation.timeline as item (item.kind + '-' + item.at)}
      {#if item.kind === 'message'}
        <div class="flex {item.message.mine ? 'justify-end' : 'justify-start'}">
          <div
            class="max-w-[80%] rounded-2xl px-4 py-2 {item.message.mine
              ? 'variant-filled-primary'
              : 'variant-soft-surface'}"
          >
            <p class="whitespace-pre-wrap text-sm">{item.message.content}</p>
            <p class="pt-1 text-right text-xs opacity-70">{whenOf(item.at)}</p>
          </div>
        </div>
      {:else if item.kind === 'interest'}
        <OpeningCard
          interest={item.interest}
          name={conversation.name}
          mine={me !== undefined && encodeHashToBase64(item.interest.user) === encodeHashToBase64(me)}
          onWithdraw={conversation.withdrawInterest}
        />
      {:else if showsAsAgreement(item.exchange.status)}
        <AgreementLine exchange={item.exchange} name={conversation.name} />
      {:else}
        <ProposalCard
          exchange={item.exchange}
          name={conversation.name}
          {me}
          onRespond={conversation.respond}
        />
      {/if}
    {/each}

    <!--
      Messages that have not gone out yet, after everything that has. They are not in the
      timeline because the timeline is what the DHT holds; these are only on this device.
    -->
    {#each conversation.waiting as item (item.id)}
      <div class="flex justify-end">
        <div class="variant-soft-surface border-surface-400 max-w-[80%] rounded-2xl border border-dashed px-4 py-2">
          <p class="whitespace-pre-wrap text-sm">{item.content}</p>
          <p class="pt-1 text-right text-xs">
            {#if item.state === 'waiting'}
              <span class="opacity-70">{S.general.waitingToSend}</span>
            {:else if item.state === 'mayNotHaveSent'}
              <button type="button" class="text-warning-700 dark:text-warning-300 underline" onclick={() => conversation.retry(item.id)}>
                {S.general.mayNotHaveSent}
              </button>
            {:else}
              <span class="text-error-700 dark:text-error-300"
                >{fill(S.conversation.sendFailed, { reason: item.reason ?? '' })}</span
              >
            {/if}
          </p>
        </div>
      </div>
    {/each}
  </div>

  {#if picking}
    <ProposalPicker
      theirs={conversation.proposable.theirs}
      yours={conversation.proposable.yours}
      name={conversation.name}
      titleOf={conversation.titleOf}
      onClose={() => (picking = false)}
      counterparty={conversation.counterparty}
    />
  {/if}

  {#if conversation.sendError}
    <aside class="card variant-soft-error p-3 text-sm" role="alert">
      {#if isTooLong(conversation.sendError)}
        <!-- The same line the composer shows, computed from what is still in the box. -->
        {fill(S.conversation.tooLongBy, { percent: over, count: pieces })}
      {:else}
        {fill(S.conversation.sendFailed, { reason: conversation.sendError })}
      {/if}
    </aside>
  {/if}

  <form
    class="flex flex-col gap-2"
    onsubmit={(e) => {
      e.preventDefault();
      conversation.send();
    }}
  >
    <label class="sr-only" for="composer">{fill(S.conversation.composer.label, { name: conversation.name })}</label>
    <textarea
      id="composer"
      class="textarea"
      rows="3"
      bind:value={conversation.draft}
      placeholder={fill(S.conversation.composer.placeholder, { name: conversation.name })}
    ></textarea>
    <div class="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        class="btn variant-filled-primary"
        disabled={conversation.sending || tooLong}
      >
        {S.conversation.send}
      </button>
      {#if showCounter}
        <span
          class="text-sm {tooLong ? 'text-error-700 dark:text-error-300' : 'text-surface-500'}"
          data-testid="limit-counter"
          aria-live="polite"
        >
          {#if tooLong}
            {fill(S.conversation.tooLongBy, { percent: over, count: pieces })}
          {:else}
            {fill(S.conversation.limitUsed, { percent: used })}
          {/if}
        </span>
      {/if}
      <button type="button" class="btn variant-ghost" onclick={() => (picking = !picking)}>
        {S.conversation.makeProposal}
      </button>
      <span class="text-surface-500 text-sm"
        >{fill(S.conversation.encrypted, { name: conversation.name })}</span
      >
    </div>
  </form>
</section>
