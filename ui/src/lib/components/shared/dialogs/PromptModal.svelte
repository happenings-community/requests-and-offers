<script lang="ts">
  import type { PromptModalMeta } from '@lib/types/ui';
  import { getModalStore } from '@skeletonlabs/skeleton';

  const modalStore = getModalStore();
  const { message, inputs } = $modalStore[0].meta as PromptModalMeta;
  let { confirmText } = $modalStore[0].meta as PromptModalMeta;

  let form: HTMLFormElement;

  function submitForm(event: SubmitEvent) {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);

    if (confirmText) {
      const confirmation = confirm(confirmText);
      if (!confirmation) {
        form.reset();
        return;
      }
    }

    $modalStore[0].response!({ data });
    modalStore.close();
  }
</script>

<article class="hcron-modal !bg-surface-800 z-20">
  <div class="static space-y-8">
    <h2 class="h2 text-center">{@html message}</h2>
    <form class="space-y-10" onsubmit={submitForm} bind:this={form}>
      {#each inputs as input}
        <label class="space-y-4">
          <span class="text-xl">{input.label}:</span>
          <input
            type={input.type}
            placeholder={input.placeholder}
            class="input bg-surface-300 dark:bg-surface-600 text-black dark:text-white"
            name={input.name}
            value={input.value}
            min={input.min}
            max={input.max}
          />
        </label>
      {/each}
      <div class="flex justify-center gap-4">
        <button type="submit" class="btn variant-filled-tertiary w-fit self-center">Submit</button>
        <button
          type="button"
          class="btn variant-filled-error w-fit self-center"
          onclick={() => modalStore.close()}
        >
          Cancel
        </button>
      </div>
    </form>
  </div>
</article>
