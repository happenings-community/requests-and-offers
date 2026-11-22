<script lang="ts">
  import { formatDateTime } from '$lib/utils/dates';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import { encodeHashToBase64 } from '@holochain/client';
  import type { Fault } from '$lib/utils/messaging-threads';

  type Props = { fault: Fault; name: string };
  const { fault, name }: Props = $props();

  const when = $derived(
    formatDateTime(fault.at)
  );

  let copied = $state(false);

  /**
   * What an admin needs to chase this, and nothing a member would not want to hand over.
   *
   * No content: the whole point is that it would not decrypt, so there is none to give,
   * and a fault report should not become a way to send message text anywhere.
   *
   * The hashes as an administrator looks them up, in base64: written straight into the
   * text they came out as a list of byte values.
   */
  const details = $derived(
    [
      `Message: ${encodeHashToBase64(fault.hash)}`,
      `From: ${encodeHashToBase64(fault.from)}`,
      `At: ${new Date(fault.at).toISOString()}`
    ].join('\n')
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
  class="card flex items-start gap-4 border border-error-300 bg-error-50 p-4 dark:bg-error-900/20"
  data-testid="fault-row"
>
  <span
    aria-hidden="true"
    class="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-error-100 text-lg font-bold text-error-800"
    >!</span
  >
  <div class="flex min-w-0 flex-1 flex-col gap-1.5">
    <div class="flex flex-wrap items-center gap-2">
      <span class="font-semibold">{fill(S.fault.title, { name })}</span>
      <span class="variant-filled-error badge">{S.fault.chip}</span>
      <span class="ml-auto text-sm text-surface-500">{when}</span>
    </div>
    <p class="text-sm text-surface-600 dark:text-surface-300">{S.fault.body}</p>
    <div class="flex flex-wrap gap-2 pt-1">
      <button type="button" class="variant-ghost btn btn-sm" onclick={copy}>
        {copied ? S.fault.copied : S.fault.copy}
      </button>
      <!-- Report to Admins is part 2: it needs send_role_message and the case flow. -->
    </div>
  </div>
</div>
