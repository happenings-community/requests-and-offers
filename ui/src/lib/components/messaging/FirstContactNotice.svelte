<script lang="ts">
  import { getModalStore } from '@skeletonlabs/skeleton';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import { COMMON_STRINGS as C } from '$lib/strings/common.strings';
  import type { FirstContactMeta } from '$lib/utils/messaging-first-contact';

  /**
   * What a member is told the first time they propose or write to somebody.
   *
   * **Its own dialog rather than the shared confirm one**, which renders its message as
   * markup. The other person's name goes in this sentence, and a name is theirs to
   * choose, so it is rendered as text.
   *
   * The continuing button says the word the member already pressed, so the notice reads
   * as a pause in what they were doing rather than a question about something else.
   */
  const modalStore = getModalStore();
  const meta = $modalStore[0].meta as FirstContactMeta;

  const said =
    meta.kind === 'chat'
      ? S.firstContact.chat
      : fill(S.firstContact.proposal, { name: meta.name || C.someoneInSentence });

  function carryOn() {
    $modalStore[0].response?.(true);
    modalStore.close();
  }

  function notNow() {
    $modalStore[0].response?.(false);
    modalStore.close();
  }
</script>

<article class="hcron-modal z-50 !bg-surface-800" data-testid="first-contact-notice">
  <div class="static space-y-6">
    <h2 class="h3">{S.firstContact.title}</h2>
    <p class="text-sm">{said}</p>
    <div class="flex justify-end gap-3">
      <button type="button" class="variant-ghost-surface btn" onclick={notNow}>
        {S.firstContact.cancel}
      </button>
      <button
        type="button"
        class="variant-filled-primary btn"
        onclick={carryOn}
        data-testid="first-contact-continue"
      >
        {meta.label}
      </button>
    </div>
  </div>
</article>
