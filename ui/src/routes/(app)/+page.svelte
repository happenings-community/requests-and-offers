<script lang="ts">
  import usersStore from '$lib/stores/users.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';

  const { currentUser } = $derived(usersStore);
  const { agentIsAdministrator } = $derived(administrationStore);

  let error: string | null = $state(null);

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
      <button class="btn btn-sm variant-soft" onclick={() => (error = null)}>Dismiss</button>
    </div>
  {/if}

  <!-- Admin Quick Access -->
  {#if agentIsAdministrator}
    <div class="fixed left-4 top-24 z-40 hidden lg:block">
      <div class="bg-error-500 rounded-lg p-3 text-white shadow-lg">
        <a href="/admin" class="flex items-center gap-2 transition-opacity hover:opacity-80">
          <span class="text-lg">⚙️</span>
          <span class="font-medium">Admin Zone</span>
        </a>
        <div class="mt-1 text-xs opacity-75">
          <kbd class="kbd bg-error-400 text-error-900 text-xs">Alt</kbd> +
          <kbd class="kbd bg-error-400 text-error-900 text-xs">A</kbd>
        </div>
      </div>
    </div>
  {/if}

  <!-- Welcome Section -->
  <div class="mb-12 text-center">
    <h1 class="h1 text-primary-700 mb-4">Welcome to Requests & Offers</h1>
    <p class="mx-auto max-w-2xl text-lg text-gray-600">
      Connect with the Holochain community to exchange skills, resources, and support. Whether
      you're looking for help or offering your expertise, this is your place to collaborate.
    </p>
  </div>

  {#if !currentUser}
    <!-- New User Experience -->
    <div class="mb-12">
      <div
        class="from-primary-500 to-secondary-500 mb-8 rounded-xl bg-gradient-to-r p-8 text-white shadow-lg"
      >
        <div class="text-center">
          <h2 class="h2 mb-4">Join the Community</h2>
          <p class="mb-6 text-lg opacity-90">
            Create your profile to start connecting with other Holochain enthusiasts
          </p>
          <a
            href="/user/create"
            class="btn variant-filled-surface hover:variant-filled-primary text-primary-700 px-8 py-3 text-lg font-semibold shadow-md transition-all hover:text-white hover:shadow-lg"
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
          <h2 class="h2 text-primary-700 mb-4">Welcome back, {currentUser.name}!</h2>
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
            class="hover:border-primary-300 group rounded-lg border border-gray-200 bg-white p-6 shadow-md transition-all hover:shadow-lg"
          >
            <div class="text-center">
              <div class="mb-4 text-4xl transition-transform group-hover:scale-110">
                {card.icon}
              </div>
              <h3 class="h3 group-hover:text-primary-700 mb-3 text-gray-800 transition-colors">
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
          class="from-secondary-500 to-secondary-600 group rounded-lg bg-gradient-to-r p-6 text-white shadow-lg transition-all hover:shadow-xl"
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
          class="from-warning-500 to-warning-600 group rounded-lg bg-gradient-to-r p-6 text-white shadow-lg transition-all hover:shadow-xl"
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
</section>

<style>
  /* Ensure admin panel doesn't interfere with mobile */
  @media (max-width: 1024px) {
    .fixed.top-24.left-4 {
      display: none;
    }
  }
</style>
