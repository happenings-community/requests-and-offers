<script lang="ts">
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import type { Fault } from '$lib/utils/messaging-threads';

  type Props = { fault: Fault; name: string };
  const { fault, name }: Props = $props();

  const when = $derived(
    new Date(fault.at).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  );

  let copied = $state(false);

  /**
   * What an admin needs to chase this, and nothing a member would not want to hand over.
   *
   * No content: the whole point is that it would not decrypt, so there is none to give,
   * and a fault report should not become a way to send message text anywhere.
   */
  const details = $derived(
    [`Message: ${fault.hash}`, `From: ${fault.from}`, `At: ${new Date(fault.at).toISOString()}`].join(
      '\n'
    )
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(details);
      copied = true;
    } catch {
      // A blocked clipboard is not worth an error dialog; the button simply does nothing
      // visible and the member can still report.
    }
  }
</script>

<div
  class="card border-error-300 bg-error-50 dark:bg-error-900/20 flex items-start gap-4 border p-4"
  data-testid="fault-row"
>
  <span
    aria-hidden="true"
    class="bg-error-100 text-error-800 flex h-11 w-11 flex-none items-center justify-center rounded-full text-lg font-bold"
    >!</span
  >
  <div class="flex min-w-0 flex-1 flex-col gap-1.5">
    <div class="flex flex-wrap items-center gap-2">
      <span class="font-semibold">{fill(S.fault.title, { name })}</span>
      <span class="variant-filled-error badge">{S.fault.chip}</span>
      <span class="text-surface-500 ml-auto text-sm">{when}</span>
    </div>
    <p class="text-surface-600 dark:text-surface-300 text-sm">{S.fault.body}</p>
    <div class="flex flex-wrap gap-2 pt-1">
      <button type="button" class="btn btn-sm variant-ghost" onclick={copy}>
        {copied ? S.fault.copied : S.fault.copy}
      </button>
      <!-- Report to Admins is part 2: it needs send_role_message and the case flow. -->
    </div>
  </div>
</div>
