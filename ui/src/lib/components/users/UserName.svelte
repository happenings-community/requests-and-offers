<script lang="ts">
  import type { UIUser } from '$lib/types/ui';
  import type { UserInDHT } from '$lib/types/holochain';
  import { formatUserName } from '$lib/schemas/users.schemas';

  type Props = {
    user: UIUser | UserInDHT | { name?: string } | null | undefined;
    fallback?: string;
    class?: string;
  };

  const { user, fallback = 'User', class: className = '' }: Props = $props();

  const display = $derived(user?.name ? formatUserName(user.name) : fallback);
</script>

<span class={className}>{display}</span>
