<script lang="ts">
  import { getModalStore } from '@skeletonlabs/skeleton';
  import { page } from '$app/state';
  import { Icon, Envelope } from 'svelte-hero-icons';
  import usersStore from '$lib/stores/users.store.svelte';
  import { openContact } from '$lib/components/users/contact';
  import { contactAbout } from '$lib/components/shared/contact-about.svelte';
  import { footerContext } from '$lib/utils/admin-contacts';

  // "Contact admin" in a footer on every page of the main app (Sam, 24
  // October): predictably placed, and quieter than a floating button. Where
  // stewarding is present, a page's "Flag this" sits at the foot of its
  // content, just above, as the design system has it.

  const modalStore = getModalStore();

  function open() {
    openContact(
      modalStore,
      footerContext(
        usersStore.currentUser?.status?.status_type,
        contactAbout.current,
        page.url.pathname
      )
    );
  }
</script>

<footer class="border-surface-300-600-token border-t py-3 text-center">
  <button type="button" class="variant-soft btn btn-sm" onclick={open}>
    <Icon src={Envelope} class="h-4 w-4" />
    <span>Contact admin</span>
  </button>
</footer>
