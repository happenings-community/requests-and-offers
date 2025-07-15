<script lang="ts">
  import { slide } from 'svelte/transition';

  let { title = '', children }: { title: string; children: any } = $props();
  let isOpen = $state(false);

  function toggle() {
    isOpen = !isOpen;
  }
</script>

<div>
  <button
    onclick={toggle}
    class="flex w-full items-center justify-between rounded-lg px-4 py-2 text-left text-lg font-semibold text-white hover:bg-surface-700 focus:outline-none"
  >
    <span>{title}</span>
    <svg
      class="h-5 w-5 transform transition-transform duration-200"
      class:rotate-180={isOpen}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"
      ></path>
    </svg>
  </button>

  {#if isOpen}
    <div transition:slide|local class="flex flex-col gap-2 py-2 pl-4">
      {@render children()}
    </div>
  {/if}
</div>
