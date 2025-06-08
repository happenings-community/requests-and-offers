<script lang="ts">
  import Bars from '$lib/components/shared/svg/bars.svelte';
  import { getDrawerStore, type DrawerSettings } from '@skeletonlabs/skeleton';
  import MenuLink from '$lib/components/shared/MenuLink.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { Effect as E, Option as O, Data, pipe } from 'effect';
  import { goto } from '$app/navigation';

  // Define a custom error type for navigation
  class NavigationError extends Data.TaggedError('NavigationError')<{
    message: string;
    cause?: unknown;
  }> {}

  const { currentUser } = $derived(usersStore);
  let isNavigating = $state(false);
  let navigationError = $state<O.Option<NavigationError>>(O.none());

  const drawerStore = getDrawerStore();
  const drawerSettings: DrawerSettings = {
    id: 'menu-drawer',
    width: 'w-1/2 sm:w-1/3',
    bgDrawer: 'bg-primary-500'
  };

  // Effect for navigation with error handling
  const navigateToProfileEffect = (path: string) =>
    E.gen(function* ($) {
      try {
        // Set navigating state
        yield* $(
          E.sync(() => {
            isNavigating = true;
            navigationError = O.none();
          })
        );

        // Navigate to the specified path
        yield* $(E.tryPromise(() => goto(path)));

        return true;
      } catch (error) {
        // Handle navigation error
        const navError = new NavigationError({
          message: 'Failed to navigate',
          cause: error
        });

        console.error('Navigation error:', error);

        yield* $(
          E.sync(() => {
            navigationError = O.some(navError);
          })
        );

        return false;
      } finally {
        // Reset navigating state
        yield* $(
          E.sync(() => {
            isNavigating = false;
          })
        );
      }
    });

  // Navigate to user profile with Effect TS
  function navigateToProfile() {
    if (!currentUser?.original_action_hash) return;

    const profilePath = `/user`;

    pipe(navigateToProfileEffect(profilePath), E.runPromise).catch((err) => {
      console.error('Unhandled navigation error:', err);
    });
  }

  function openDrawer() {
    drawerStore.open(drawerSettings);
  }
</script>

<nav class="flex h-32 w-full items-center justify-between bg-primary-500 p-4">
  <div class="flex w-full items-center justify-between">
    <a href="/" class="">
      <img src="/hAppeningsCIClogo.png" alt="hAppenings Community Logo" class="w-28" />
    </a>

    <a class="h2 text-center text-white" href="/">Requests & Offers - MVP</a>

    <div class="flex justify-end gap-4">
      <button class="variant-filled-secondary btn lg:hidden" onclick={openDrawer}>
        <Bars svgClass="fill-white h-6 w-6" />
      </button>
    </div>
  </div>

  <div class="hidden flex-col justify-end gap-4 sm:flex-row lg:flex">
    <div class="flex flex-col gap-3">
      {#if isNavigating}
        <div class="flex items-center gap-2 text-white">
          <span class="loading loading-spinner loading-sm"></span>
          <span>Navigating...</span>
        </div>
      {:else if O.isSome(navigationError)}
        <div class="flex items-center gap-2">
          <span class="text-error-500"
            >{O.getOrElse(navigationError, () => ({ message: 'Navigation error' })).message}</span
          >
        </div>
      {:else if currentUser}
        <button class="text-left text-white hover:text-secondary-300" onclick={navigateToProfile}>
          My profile
        </button>
      {:else}
        <MenuLink href="/user/create">Create Profile</MenuLink>
      {/if}
      <MenuLink href="/users">All Users</MenuLink>
    </div>
    <div class="flex flex-col gap-3">
      <MenuLink href="/organizations">Organizations</MenuLink>
      <MenuLink href="/projects">Projects</MenuLink>
    </div>
    <div class="flex flex-col gap-3">
      <MenuLink href="/requests">Requests</MenuLink>
      <MenuLink href="/offers">Offers</MenuLink>
    </div>
  </div>
</nav>
