<script lang="ts">
  import { getDrawerStore } from '@skeletonlabs/skeleton';
  import MenuLink from '$lib/components/shared/MenuLink.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { Effect as E, Option as O, Data, pipe } from 'effect';
  import { goto } from '$app/navigation';

  // Define a custom error type for navigation
  class NavigationError extends Data.TaggedError('NavigationError')<{
    message: string;
    cause?: unknown;
  }> {}

  const drawerStore = getDrawerStore();
  const { currentUser } = $derived(usersStore);
  const { agentIsAdministrator } = $derived(administrationStore);

  let isNavigating = $state(false);
  let navigationError = $state<O.Option<NavigationError>>(O.none());

  // Effect for navigation with error handling
  const navigateEffect = (path: string) =>
    E.gen(function* (_) {
      try {
        // Set navigating state
        yield* _(
          E.sync(() => {
            isNavigating = true;
            navigationError = O.none();
          })
        );

        // Close drawer first
        drawerStore.close();

        // Navigate to the specified path
        yield* _(E.tryPromise(() => goto(path)));

        return true;
      } catch (error) {
        // Handle navigation error
        const navError = new NavigationError({
          message: 'Failed to navigate',
          cause: error
        });

        console.error('Navigation error:', error);

        yield* _(
          E.sync(() => {
            navigationError = O.some(navError);
          })
        );

        return false;
      } finally {
        // Reset navigating state
        yield* _(
          E.sync(() => {
            isNavigating = false;
          })
        );
      }
    });

  // Navigate to user profile with Effect TS
  function navigateToProfile() {
    if (!currentUser?.original_action_hash) return;

    pipe(navigateEffect('/user'), E.runPromise).catch((err) => {
      console.error('Unhandled navigation error:', err);
    });
  }

  // Navigate to a page with Effect TS
  function navigateTo(path: string) {
    pipe(navigateEffect(path), E.runPromise).catch((err) => {
      console.error('Unhandled navigation error:', err);
    });
  }
</script>

<div class="h-10 space-y-5 p-2 md:p-5">
  <div class="flex justify-center">
    <button class="cursor-pointer" onclick={() => navigateTo('/')}>
      <img src="/hAppeningsCIClogo.png" alt="hAppenings Logo" class="w-28" />
    </button>
  </div>

  {#if isNavigating}
    <div class="flex items-center justify-center gap-2 p-4">
      <span class="loading loading-spinner loading-md"></span>
      <span class="text-white">Navigating...</span>
    </div>
  {:else if O.isSome(navigationError)}
    <div class="flex flex-col items-center gap-2 p-4">
      <span class="text-error-500"
        >{O.getOrElse(navigationError, () => ({ message: 'Navigation error' })).message}</span
      >
      <button class="variant-filled-error btn btn-sm" onclick={() => (navigationError = O.none())}>
        Dismiss
      </button>
    </div>
  {:else}
    <div class="flex flex-col gap-3">
      {#if currentUser}
        <button class="text-left text-white hover:text-secondary-300" onclick={navigateToProfile}>
          My profile
        </button>
      {:else}
        <button
          class="text-left text-white hover:text-secondary-300"
          onclick={() => navigateTo('/user/create')}
        >
          Create Profile
        </button>
      {/if}
      <button
        class="text-left text-white hover:text-secondary-300"
        onclick={() => navigateTo('/users')}
      >
        All Users
      </button>
    </div>
    <div class="flex flex-col gap-3">
      <button
        class="text-left text-white hover:text-secondary-300"
        onclick={() => navigateTo('/organizations')}
      >
        Organizations
      </button>
      <button
        class="text-left text-white hover:text-secondary-300"
        onclick={() => navigateTo('/projects')}
      >
        Projects
      </button>
    </div>
    <div class="flex flex-col gap-3">
      <button
        class="text-left text-white hover:text-secondary-300"
        onclick={() => navigateTo('/requests')}
      >
        Requests
      </button>
      <button
        class="text-left text-white hover:text-secondary-300"
        onclick={() => navigateTo('/offers')}
      >
        Offers
      </button>
    </div>
    {#if agentIsAdministrator}
      <div class="flex flex-col gap-3 lg:hidden">
        <button
          class="variant-ringed-secondary text-left text-white hover:variant-filled-secondary hover:text-secondary-300"
          onclick={() => navigateTo('/admin')}
        >
          Admin panel
        </button>
      </div>
    {/if}
  {/if}
</div>
