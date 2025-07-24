<script lang="ts">
  import { getAvatarUrl } from '$lib/utils';

  type Props = {
    /** The user's avatar URL (optional) */
    avatarUrl?: string | null;
    /** Alternative text for the avatar */
    alt?: string;
    /** Size class for the avatar (Skeleton UI classes) */
    size?: string;
    /** Additional CSS classes */
    class?: string;
  };

  const {
    avatarUrl,
    alt = 'User avatar',
    size = 'w-12 h-12',
    class: className = ''
  }: Props = $props();

  // Use the avatar utility to get the correct URL or fallback to default
  const imageUrl = $derived(getAvatarUrl(avatarUrl));
</script>

<img src={imageUrl} {alt} class="rounded-full object-cover {size} {className}" loading="lazy" />

<style>
  img {
    /* Fallback styling in case the image fails to load */
    background-color: var(--color-surface-200);
  }
</style>
