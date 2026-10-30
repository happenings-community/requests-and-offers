<script lang="ts">
  import { page } from '$app/stores';
  import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
  import { useConversation } from '$lib/composables/domain/messaging/useConversation.svelte';
  import OpeningCard from '$lib/components/messaging/OpeningCard.svelte';
  import ProposalCard from '$lib/components/messaging/ProposalCard.svelte';
  import AgreementLine from '$lib/components/messaging/AgreementLine.svelte';
  import ProposalPicker from '$lib/components/messaging/ProposalPicker.svelte';
  import SharedListingCard from '$lib/components/messaging/SharedListingCard.svelte';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  // Making a proposal is the same action here as on a listing page, so it is the same
  // words, read from where they live.
  import { EXCHANGE_STRINGS as E } from '$lib/strings/exchanges.strings';
  import usersStore from '$lib/stores/users.store.svelte';
  import messagingStore from '$lib/stores/messaging.store.svelte';
  import type { ReceiptSetting } from '$lib/utils/messaging-local';
  import {
    bytesLeft,
    isTooLong,
    messagesNeeded,
    percentOver,
    percentUsed,
    showsAsAgreement,
    type TimelineItem
  } from '$lib/utils/messaging-threads';
  import { paths } from '$lib/paths';
  import { COMMON_STRINGS as C } from '$lib/strings/common.strings';

  // The route is `[user]`, so SvelteKit always has it here; the fallback keeps the type
  // honest rather than asserting non-null.
  const conversation = useConversation($page.params.user ?? '');
  const me = $derived(usersStore.currentUser?.original_action_hash);

  /**
   * Only an accepted member can send; a pending or suspended member reads and does not
   * reply. The zome refuses them anyway, but a composer that works until Send is a
   * promise the page cannot keep, and the refusal text does not tell "not allowed" from
   * "broken". A status not read yet is its own case, not a "not accepted".
   */
  const membership = $derived(usersStore.currentUser?.status?.status_type);
  const canSend = $derived(membership === 'accepted');

  /** Each item by its own hash: two of one kind in the same millisecond are two keys. */
  const keyOf = (item: TimelineItem): string =>
    item.kind === 'message'
      ? encodeHashToBase64(item.message.hash)
      : item.kind === 'interest'
        ? encodeHashToBase64(item.interest.interest_hash)
        : encodeHashToBase64(item.exchange.agreement_hash);

  // Nudges, receipts and the outbox's retries are the root layout's: they carry on after
  // this conversation is left, which is what a message waiting to send needs.
  $effect(() => {
    conversation.initialize();
  });

  let picking = $state(false);
  let sharing = $state(false);
  let confirmingBlock = $state(false);

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
  <a class="text-sm text-surface-500 no-underline" href={paths.messages()}
    >← {S.conversation.back}</a
  >

  <header class="flex flex-col gap-1">
    <h1 class="h2">{conversation.name}</h1>
    <p class="text-sm text-surface-500">
      {fill(S.conversation.subtitle, { name: conversation.name })}
    </p>
    {#if conversation.loaded}
      <div class="flex flex-wrap items-center gap-2 pt-1">
        {#if messagingStore.isBlocked(conversation.counterparty)}
          <span class="variant-soft-error badge"
            >{fill(S.block.blockedNotice, { name: conversation.name })}</span
          >
          <button
            type="button"
            class="variant-ghost btn btn-sm"
            onclick={() => messagingStore.setBlocked(conversation.counterparty, false)}
            >{S.block.unblock}</button
          >
        {:else if confirmingBlock}
          <!-- Inline, not a modal, as the design has it. -->
          <span class="text-sm">{fill(S.block.confirm.body, { name: conversation.name })}</span>
          <button
            type="button"
            class="variant-filled-error btn btn-sm"
            onclick={() => {
              messagingStore.setBlocked(conversation.counterparty, true);
              confirmingBlock = false;
            }}>{fill(S.block.confirm.yes, { name: conversation.name })}</button
          >
          <button
            type="button"
            class="variant-ghost btn btn-sm"
            onclick={() => (confirmingBlock = false)}>{S.proposal.declineForm.cancel}</button
          >
        {:else}
          <button
            type="button"
            class="variant-ghost btn btn-sm"
            onclick={() => (confirmingBlock = true)}>{S.block.button}</button
          >
        {/if}

        <!--
        Per chat, in three states. A boolean here would mean the overall setting either
        silently flipped a chat the member had set, or silently failed to reach it.
      -->
        <label class="ml-auto flex items-center gap-2 text-sm">
          <span class="text-surface-500">{S.chat.receipts}</span>
          <select
            class="select-sm select w-auto"
            value={conversation.receiptSetting}
            onchange={(e) => conversation.setReceipts(e.currentTarget.value as ReceiptSetting)}
            data-testid="chat-receipts"
          >
            <option value="inherit">{S.chat.receiptsInherit}</option>
            <option value="on">{S.chat.receiptsOn}</option>
            <option value="off">{S.chat.receiptsOff}</option>
          </select>
        </label>
      </div>
    {/if}
  </header>

  {#if conversation.missing === 'address'}
    <aside class="card variant-soft-error p-4 text-sm" role="alert">
      {S.conversation.notAnAddress}
    </aside>
  {:else if conversation.missing === 'member'}
    <aside class="card variant-soft-warning p-4 text-sm" role="alert">
      {S.conversation.memberNotFound}
    </aside>
  {:else if conversation.loadError}
    <!--
      A failed read is a fault with a way to try again, never an empty chat: an empty
      chat is what a new conversation looks like, and this one may hold forty messages.
    -->
    <aside
      class="card variant-soft-error flex flex-wrap items-center gap-3 p-4"
      role="alert"
      data-testid="conversation-fault"
    >
      <span class="text-sm"
        >{fill(S.conversation.loadFailed, { reason: conversation.loadError })}</span
      >
      <button
        type="button"
        class="variant-filled btn btn-sm"
        onclick={() => conversation.initialize()}>{C.tryAgain}</button
      >
    </aside>
  {:else if !conversation.loaded && !conversation.thread}
    <!-- Not yet read is not an answer either. -->
    <p class="text-surface-500">{C.loading}</p>
  {:else}
    <div class="flex flex-col gap-3" data-testid="timeline">
      {#each conversation.timeline as item (item.kind + '-' + keyOf(item))}
        {#if item.kind === 'message' && item.message.listing}
          <!--
          A card-only message: it carries a listing and no text, so it renders as a card
          rather than as something somebody wrote.
        -->
          <SharedListingCard
            listing={item.message.listing}
            mine={item.message.mine}
            name={conversation.name}
          />
        {:else if item.kind === 'message'}
          <div class="flex {item.message.mine ? 'justify-end' : 'justify-start'}">
            <div
              class="max-w-[80%] rounded-2xl px-4 py-2 {item.message.mine
                ? 'variant-filled-primary'
                : 'variant-soft-surface'}"
            >
              <p class="whitespace-pre-wrap text-sm">{item.message.content}</p>
              <p class="pt-1 text-right text-xs opacity-70">
                {whenOf(item.at)}{#if item.message.mine}
                  · {conversation.statusOf(item.at) === 'read' ? S.status.read : S.status.sent}
                {/if}
              </p>
            </div>
          </div>
        {:else if item.kind === 'interest'}
          <OpeningCard
            interest={item.interest}
            name={conversation.name}
            mine={me !== undefined &&
              encodeHashToBase64(item.interest.user) === encodeHashToBase64(me)}
            onWithdraw={conversation.withdrawInterest}
          />
        {:else if showsAsAgreement(item.exchange)}
          <AgreementLine
            exchange={item.exchange}
            name={conversation.name}
            counterparty={conversation.counterparty}
          />
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
          <div
            class="variant-soft-surface max-w-[80%] rounded-2xl border border-dashed border-surface-400 px-4 py-2"
          >
            {#if item.listing}
              <!-- A card that has not gone yet is still a card, drawn from the listing. -->
              <SharedListingCard
                listing={decodeHashFromBase64(item.listing)}
                mine={true}
                name={conversation.name}
              />
            {:else}
              <p class="whitespace-pre-wrap text-sm">{item.content}</p>
            {/if}
            <p class="pt-1 text-right text-xs">
              {#if item.state === 'waiting'}
                <span class="opacity-70">{S.general.waitingToSend}</span>
              {:else if item.state === 'mayNotHaveSent'}
                <button
                  type="button"
                  class="text-warning-700 underline dark:text-warning-300"
                  onclick={() => conversation.retry(item.id)}
                >
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

    {#if sharing}
      <section class="card flex flex-col gap-2 p-4" data-testid="share-listing">
        <h2 class="h4">{S.conversation.shareListing}</h2>
        <p class="text-sm text-surface-500">{S.conversation.shareListingIntro}</p>
        {#each conversation.shareable as item (encodeHashToBase64(item.hash))}
          <button
            type="button"
            class="card flex items-center gap-3 p-3 text-left transition-colors hover:bg-surface-100 dark:hover:bg-surface-700"
            onclick={async () => {
              await conversation.shareListing(item.hash);
              sharing = false;
            }}
          >
            <span
              class="badge {item.type === 'Offer'
                ? 'variant-soft-warning'
                : 'variant-soft-secondary'}"
              >{item.type === 'Offer' ? C.listingType.offer : C.listingType.request}</span
            >
            <span class="min-w-0 flex-1 truncate">{item.title}</span>
          </button>
        {:else}
          <p class="text-surface-500 text-sm">{S.picker.none}</p>
        {/each}
      </section>
    {/if}

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

    {#if canSend}
      <form
        class="flex flex-col gap-2"
        onsubmit={(e) => {
          e.preventDefault();
          conversation.send();
        }}
      >
        <label class="sr-only" for="composer"
          >{fill(S.conversation.composer.label, { name: conversation.name })}</label
        >
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
            class="variant-filled-primary btn"
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
          <button type="button" class="variant-ghost btn" onclick={() => (picking = !picking)}>
            {E.listing.makeProposal}
          </button>
          <button
            type="button"
            class="variant-ghost btn"
            onclick={() => {
              sharing = !sharing;
              if (sharing) conversation.loadShareable();
            }}>{S.conversation.shareListing}</button
          >
          <span class="text-sm text-surface-500"
            >{fill(S.conversation.encrypted, { name: conversation.name })}
            {S.receipts.optional}</span
          >
        </div>
      </form>
    {:else}
      <aside class="card variant-soft-warning p-3 text-sm" data-testid="cannot-send">
        {membership === undefined ? S.conversation.membershipUnknown : S.general.notAccepted}
      </aside>
    {/if}
  {/if}
</section>
