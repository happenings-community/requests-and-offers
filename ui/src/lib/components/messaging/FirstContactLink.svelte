<script lang="ts">
  import { goto } from '$app/navigation';
  import { getModalStore } from '@skeletonlabs/skeleton';
  import type { FirstContactProps } from '$lib/extensions/first-contact';
  import { firstContactNeeded, openFirstContact } from '$lib/utils/messaging-first-contact';

  /**
   * **What messaging supplies to the formal pages: the same link, with a word first.**
   *
   * It is an ordinary link, so it behaves like one — opened in a new tab, or pressed by
   * somebody who has already been told, it simply goes. Only a member's first time is
   * interrupted, and then only to say what the record they are about to write can be read
   * by.
   *
   * The page keeps the word and the address; this knows nothing about listings or
   * interests. **Nothing on the formal route imports this file**: it is plugged in by the
   * root layout and reached only through `extensions/first-contact.ts`.
   */
  const {
    kind,
    href,
    label,
    name,
    classes = 'variant-filled-primary btn'
  }: FirstContactProps = $props();

  const modalStore = getModalStore();

  function press(event: MouseEvent) {
    // Already told, so the link is just a link.
    if (!firstContactNeeded()) return;
    event.preventDefault();
    openFirstContact(modalStore, { kind, name, label }, () => {
      void goto(href);
    });
  }
</script>

<a {href} class={classes} onclick={press} data-testid="first-contact-link">{label}</a>
