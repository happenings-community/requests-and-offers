<script lang="ts">
  import type { PromptModalMeta } from '$lib/types/ui';
  import { getModalStore } from '@skeletonlabs/skeleton';

  const modalStore = getModalStore();
  const { message, inputs } = $modalStore[0].meta as PromptModalMeta;
  let { confirmText } = $modalStore[0].meta as PromptModalMeta;

  let form: HTMLFormElement;
  
  // State for password visibility and caps lock detection
  let passwordVisibility = $state<Record<string, boolean>>({});
  let capsLockStates = $state<Record<string, boolean>>({});

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

  function togglePasswordVisibility(inputName: string) {
    passwordVisibility[inputName] = !passwordVisibility[inputName];
  }

  function detectCapsLock(event: KeyboardEvent, inputName: string) {
    // Method 1: Try getModifierState first
    if (event.getModifierState) {
      capsLockStates[inputName] = event.getModifierState('CapsLock');
      return;
    }
    
    // Method 2: Fallback - detect from character input
    if (event.key && event.key.length === 1) {
      const char = event.key;
      const isLetter = /[a-zA-Z]/.test(char);
      
      if (isLetter) {
        const isUpperCase = char === char.toUpperCase();
        const isShiftPressed = event.shiftKey;
        
        // CAPS LOCK is likely on if:
        // - Character is uppercase and shift is NOT pressed, OR
        // - Character is lowercase and shift IS pressed
        capsLockStates[inputName] = (isUpperCase && !isShiftPressed) || (!isUpperCase && isShiftPressed);
      }
    }
  }

  function handleCapsLockKey(event: KeyboardEvent, inputName: string) {
    // Handle CAPS LOCK key specifically
    if (event.key === 'CapsLock') {
      // Toggle the state on keydown
      if (event.type === 'keydown') {
        capsLockStates[inputName] = !capsLockStates[inputName];
      }
    }
  }

  function handleInputFocus(inputName: string) {
    // Reset and try to detect current CAPS LOCK state
    // We'll rely on the first keystroke to determine the state
    capsLockStates[inputName] = false;
  }

  // Initialize password visibility state for all password inputs
  $effect(() => {
    inputs.forEach(input => {
      if (input.type === 'password') {
        passwordVisibility[input.name] = false;
        capsLockStates[input.name] = false;
      }
    });
  });
</script>

<article class="hcron-modal !bg-surface-800 z-20">
  <div class="static space-y-8">
    <h2 class="h2 text-center">{@html message}</h2>
    <form class="space-y-10" onsubmit={submitForm} bind:this={form}>
      {#each inputs as input}
        <label class="space-y-4">
          <span class="text-xl">{input.label}:</span>
          
          {#if input.type === 'password'}
            <div class="relative">
              <input
                type={passwordVisibility[input.name] ? 'text' : 'password'}
                placeholder={input.placeholder}
                class="input bg-surface-300 dark:bg-surface-600 text-black dark:text-white pr-12"
                name={input.name}
                value={input.value}
                min={input.min}
                max={input.max}
                onkeydown={(e) => { detectCapsLock(e, input.name); handleCapsLockKey(e, input.name); }}
                onkeypress={(e) => detectCapsLock(e, input.name)}
                onfocus={() => handleInputFocus(input.name)}
              />
              
              <!-- Password toggle button -->
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200 focus:outline-none"
                onclick={() => togglePasswordVisibility(input.name)}
                aria-label={passwordVisibility[input.name] ? 'Hide password' : 'Show password'}
              >
                {#if passwordVisibility[input.name]}
                  <!-- Eye slash icon (hide password) -->
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
                  </svg>
                {:else}
                  <!-- Eye icon (show password) -->
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                  </svg>
                {/if}
              </button>
              
              <!-- CAPS LOCK indicator -->
              {#if capsLockStates[input.name]}
                <div class="absolute -bottom-6 left-0 flex items-center gap-2 text-warning-600 text-sm">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                  </svg>
                  <span>CAPS LOCK is ON</span>
                </div>
              {/if}
            </div>
          {:else}
            <input
              type={input.type}
              placeholder={input.placeholder}
              class="input bg-surface-300 dark:bg-surface-600 text-black dark:text-white"
              name={input.name}
              value={input.value}
              min={input.min}
              max={input.max}
            />
          {/if}
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
