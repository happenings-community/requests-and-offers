<script lang="ts" module>
  /** One way on from an error state. At most one is primary. */
  export type ErrorStateAction = { label: string; href: string; primary?: boolean };
</script>

<script lang="ts">
  /**
   * A page that cannot show what it was opened for, said calmly and with a way on.
   *
   * The app's own port of the design system's `ErrorView`: a card on the surface colour,
   * the brand's violet and sunflower as a band along its top, an icon, a short title, one
   * sentence of what happened, and actions. Theme colours throughout, so it reads the same
   * in light and dark; no error-red block, because not being able to open a page is
   * information, not an alarm. `ErrorDisplay` stays the component for an operation that
   * failed inside a page that did open.
   */
  type Props = {
    title: string;
    body: string;
    icon?: string;
    eyebrow?: string;
    /** What the app reported, kept apart from the explanation and quieter than it. */
    detail?: string;
    detailLabel?: string;
    actions?: ErrorStateAction[];
    retryLabel?: string;
    onretry?: () => void;
  };

  const {
    title,
    body,
    icon,
    eyebrow,
    detail,
    detailLabel = 'Details:',
    actions = [],
    retryLabel = 'Try again',
    onretry
  }: Props = $props();
</script>

<section
  class="card relative overflow-hidden border border-surface-200 p-6 pt-8 shadow-md dark:border-surface-600 sm:p-8 sm:pt-10"
  aria-labelledby="error-state-title"
  data-testid="error-state"
>
  <div
    class="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary-500 from-70% to-secondary-500 to-70%"
    aria-hidden="true"
  ></div>

  {#if icon || eyebrow}
    <div class="mb-4 flex items-center gap-4">
      {#if icon}
        <span
          class="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary-500/10 text-3xl dark:bg-primary-300/20"
          aria-hidden="true">{icon}</span
        >
      {/if}
      {#if eyebrow}
        <p
          class="text-xs font-semibold uppercase tracking-widest text-surface-600 dark:text-surface-300"
        >
          {eyebrow}
        </p>
      {/if}
    </div>
  {/if}

  <h1 id="error-state-title" class="h3 mb-2 font-bold">{title}</h1>
  <p class="max-w-prose text-surface-700 dark:text-surface-200">{body}</p>

  {#if detail}
    <p class="mt-3 break-words text-sm text-surface-600 dark:text-surface-300">
      {detailLabel} <span class="text-surface-900 dark:text-surface-50">{detail}</span>
    </p>
  {/if}

  {#if actions.length || onretry}
    <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      {#each actions as action (action.href)}
        <a
          href={action.href}
          class="btn {action.primary ? 'variant-filled-primary' : 'variant-ghost-surface'}"
        >
          {action.label}
        </a>
      {/each}
      {#if onretry}
        <button type="button" class="variant-ghost-surface btn" onclick={onretry}>
          {retryLabel}
        </button>
      {/if}
    </div>
  {/if}
</section>
