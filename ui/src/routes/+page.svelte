<script lang="ts">
  import { onMount } from 'svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import hc from '$lib/services/HolochainClientService.svelte';
  import type { UIUser } from '$lib/types/ui';
  import { useBackgroundAdminCheck } from '$lib/composables/connection/useBackgroundAdminCheck.svelte';

  let error: string | null = $state(null);
  let isLoading = $state(true);

  // Background admin status checking (replaces direct store access)
  const backgroundAdminCheck = useBackgroundAdminCheck();
  const agentIsAdministrator = $derived(backgroundAdminCheck.isAdmin);
  const adminCheckReady = $derived(backgroundAdminCheck.isReady);

  // Reactive access to current user - will update when loaded in background
  const currentUser = $derived(usersStore.currentUser);

  // Load stores data after component mounts and Holochain is connected
  onMount(async () => {
    // Wait for Holochain connection
    while (!hc.isConnected) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // App is ready to use - user data will load in background
    isLoading = false;
  });

  // Quick action cards for new users
  const quickActions = [
    {
      title: 'Discover Opportunities',
      description: 'Browse requests from the community and find ways to help',
      icon: '🔍',
      href: '/requests',
      color: 'bg-secondary-500 hover:bg-secondary-600'
    },
    {
      title: 'Offer Your Skills',
      description: 'Share your expertise and help others in the community',
      icon: '✨',
      href: '/offers',
      color: 'bg-warning-500 hover:bg-warning-600'
    },
    {
      title: 'Explore Community',
      description: 'Connect with other members, organizations, and projects',
      icon: '👥',
      href: '/users',
      color: 'bg-tertiary-500 hover:bg-tertiary-600'
    }
  ];

  // User activity cards for existing users
  const userActivityCards = [
    {
      title: 'My Requests',
      description: 'Manage your requests for help',
      icon: '📋',
      href: '/requests?filter=my',
      color: 'bg-primary-500 hover:bg-primary-600'
    },
    {
      title: 'My Offers',
      description: 'Track your offers to help others',
      icon: '🎯',
      href: '/offers?filter=my',
      color: 'bg-secondary-500 hover:bg-secondary-600'
    },
    {
      title: 'My Profile',
      description: 'Update your profile and skills',
      icon: '👤',
      href: '/user',
      color: 'bg-tertiary-500 hover:bg-tertiary-600'
    }
  ];
</script>

<section class="mx-auto w-full max-w-6xl px-4 py-8">
  {#if error}
    <div class="alert variant-filled-error mb-6">
      <p>{error}</p>
      <button class="variant-soft btn btn-sm" onclick={() => (error = null)}>Dismiss</button>
    </div>
  {/if}

  {#if isLoading}
    <div class="flex min-h-[50vh] items-center justify-center">
      <div class="text-center">
        <div class="mb-4">
          <div
            class="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary-500"
          ></div>
        </div>
        <p class="text-lg text-gray-600">Loading dashboard...</p>
      </div>
    </div>
  {:else}
    <!-- Admin Quick Access - Only show when admin status is verified -->
    {#if agentIsAdministrator && adminCheckReady}
      <!-- Mobile Admin Button -->
      <div class="fixed bottom-4 right-4 z-40 lg:hidden">
        <a
          href="/admin"
          class="flex h-14 w-14 items-center justify-center rounded-full bg-error-500 text-white shadow-lg transition-all hover:scale-110 hover:bg-error-600"
          aria-label="Admin Zone"
        >
          <span class="text-2xl">⚙️</span>
        </a>
      </div>

      <!-- Desktop Admin Panel -->
      <div class="fixed left-4 top-24 z-40 hidden lg:block">
        <div class="rounded-lg bg-error-500 p-3 text-white shadow-lg">
          <a href="/admin" class="flex items-center gap-2 transition-opacity hover:opacity-80">
            <span class="text-lg">⚙️</span>
            <span class="font-medium">Admin Zone</span>
          </a>
          <div class="mt-1 text-xs opacity-75">
            <kbd class="kbd bg-error-400 text-xs text-error-900">Alt</kbd> +
            <kbd class="kbd bg-error-400 text-xs text-error-900">A</kbd>
          </div>
        </div>
      </div>
    {:else if backgroundAdminCheck.isChecking && !isLoading}
      <!-- Loading state for admin verification - subtle indicator -->
      <div class="fixed left-4 top-24 z-40 hidden lg:block">
        <div class="rounded-lg bg-surface-400 p-2 text-white opacity-60 shadow-lg">
          <div class="flex items-center gap-2">
            <div class="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
            <span class="text-xs">Verifying permissions...</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- Welcome Section -->
    <div class="mb-12 text-center">
      <h1 class="h1 mb-4 text-primary-700">Welcome to Requests & Offers</h1>
      <p class="mx-auto max-w-2xl text-lg text-gray-600">
        Connect with the Holochain community to exchange skills, resources, and support. Whether
        you're looking for help or offering your expertise, this is your place to collaborate.
      </p>
    </div>

    {#if !currentUser}
      <!-- New User Experience -->
      <div class="mb-12">
        <div
          class="mb-8 rounded-xl bg-gradient-to-r from-primary-500 to-secondary-500 p-8 text-white shadow-lg"
        >
          <div class="text-center">
            <h2 class="h2 mb-4">Join the Community</h2>
            <p class="mb-6 text-lg opacity-90">
              Create your profile to start connecting with other Holochain enthusiasts
            </p>
            <a
              href="/user/create"
              class="variant-filled-surface btn px-8 py-3 text-lg font-semibold text-primary-700 shadow-md transition-all hover:variant-filled-primary hover:text-white hover:shadow-lg"
            >
              👤 Create Profile
            </a>
          </div>
        </div>

        <!-- Quick Actions for New Users -->
        <div class="grid gap-6 md:grid-cols-3">
          {#each quickActions as action}
            <div
              class="rounded-lg border border-gray-200 bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
            >
              <div class="text-center">
                <div class="mb-4 text-4xl">{action.icon}</div>
                <h3 class="h3 mb-3 text-gray-800">{action.title}</h3>
                <p class="mb-4 text-gray-600">{action.description}</p>
                <a
                  href={action.href}
                  class="btn {action.color} px-6 py-2 font-medium text-white transition-colors"
                >
                  Explore
                </a>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <!-- Existing User Experience -->
      <div class="mb-12">
        <div class="mb-8 rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
          <div class="text-center">
            <h2 class="h2 mb-4 text-primary-700">Welcome back, {currentUser?.name}!</h2>
            <p class="mb-6 text-lg text-gray-600">
              Ready to make a difference in the community today?
            </p>
          </div>
        </div>

        <!-- User Activity Cards -->
        <div class="mb-8 grid gap-6 md:grid-cols-3">
          {#each userActivityCards as card}
            <a
              href={card.href}
              class="group rounded-lg border border-gray-200 bg-white p-6 shadow-md transition-all hover:border-primary-300 hover:shadow-lg"
            >
              <div class="text-center">
                <div class="mb-4 text-4xl transition-transform group-hover:scale-110">
                  {card.icon}
                </div>
                <h3 class="h3 mb-3 text-gray-800 transition-colors group-hover:text-primary-700">
                  {card.title}
                </h3>
                <p class="text-gray-600">{card.description}</p>
              </div>
            </a>
          {/each}
        </div>

        <!-- Primary Actions -->
        <div class="grid gap-6 md:grid-cols-2">
          <a
            href="/requests"
            class="group rounded-lg bg-gradient-to-r from-secondary-500 to-secondary-600 p-6 text-white shadow-lg transition-all hover:shadow-xl"
          >
            <div class="flex items-center gap-4">
              <div class="text-4xl transition-transform group-hover:scale-110">📝</div>
              <div>
                <h3 class="h3 mb-2">Browse Requests</h3>
                <p class="opacity-90">Find requests you can help with</p>
              </div>
            </div>
          </a>

          <a
            href="/offers"
            class="group rounded-lg bg-gradient-to-r from-warning-500 to-warning-600 p-6 text-white shadow-lg transition-all hover:shadow-xl"
          >
            <div class="flex items-center gap-4">
              <div class="text-4xl transition-transform group-hover:scale-110">💡</div>
              <div>
                <h3 class="h3 mb-2">Browse Offers</h3>
                <p class="opacity-90">See what help is available</p>
              </div>
            </div>
          </a>
        </div>
      </div>
    {/if}

    <!-- Community Stats or Features -->
    <div class="rounded-lg bg-gray-50 p-6 text-center">
      <h3 class="h3 mb-4 text-gray-800">Community Features</h3>
      <div class="grid gap-4 text-sm md:grid-cols-3">
        <div class="flex items-center justify-center gap-2">
          <span class="text-lg">🏷️</span>
          <span class="text-gray-600">Service Types & Skills</span>
        </div>
        <div class="flex items-center justify-center gap-2">
          <span class="text-lg">💱</span>
          <span class="text-gray-600">Flexible Payment Methods</span>
        </div>
        <div class="flex items-center justify-center gap-2">
          <span class="text-lg">🏢</span>
          <span class="text-gray-600">Organizations & Projects</span>
        </div>
      </div>
    </div>
  {/if}
</section>
