<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import { getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import ContactModal from '$lib/components/shared/listings/ContactModal.svelte';
  import { getReachPerson } from '$lib/extensions/reach-person';
  import { EXCHANGE_STRINGS as S, fill } from '$lib/strings/exchanges.strings';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import type { UIOrganization, UIUser } from '$lib/types/ui';

  /**
   * **One way to reach the other person, whatever this network is** (R121, R122, brief H4).
   *
   * Every exchange surface renders this and nothing else: whatever is plugged into
   * `extensions/reach-person.ts` — messaging's Go to chat with its count — or, when nothing
   * is, the formal Contact pop-up (R78 as amended). The page passes who, not how.
   *
   * **This file imports nothing of messaging**, which is what the seam test checks. It does
   * not even ask whether messaging is present: "nothing is plugged in" is the only question
   * it needs answered, and the layout is what decides that from H2's reading of the DNA.
   */
  type Props = {
    /**
     * The other person's `User`. Undefined renders nothing: a counterparty that cannot be
     * resolved is a fault elsewhere, and a dead Contact button would be worse than silence.
     */
    person: ActionHash | undefined;
    /** For the pop-up's subject line, when a listing is what brought them here. */
    listingType?: 'request' | 'offer';
    listingTitle?: string;
    /** An organisation's details stand in for a member's, as on the listing pages. */
    organization?: UIOrganization | null;
  };
  const {
    person,
    listingType = 'request',
    listingTitle = '',
    organization = null
  }: Props = $props();

  const plugged = getReachPerson();
  const Reach = $derived(plugged());

  const modalStore = getModalStore();

  /**
   * Read only when Contact is what we are showing.
   *
   * The pop-up needs the person's own details, and the pages have a hash. Fetching here
   * keeps every call site to one prop; fetching only in the fallback means a network with
   * messaging does no extra read at all.
   */
  let contact = $state<UIUser | null>(null);
  let looked = $state(false);

  $effect(() => {
    if (Reach || !person) return;
    const hash = person;
    (async () => {
      contact = (await runEffect(usersStore.getUserByActionHash(hash))) ?? null;
      looked = true;
    })();
  });

  const name = $derived(contact?.name?.split(' ')[0] ?? '');
  const reachable = $derived(!!(contact?.email || contact?.phone || organization?.email));

  function openContact() {
    const component: ModalComponent = {
      ref: ContactModal,
      props: { user: contact, organization, listingType, listingTitle }
    };
    modalStore.trigger({ type: 'component', component, meta: { title: '', body: '' } });
  }
</script>

{#if person}
  {#if Reach}
    <Reach {person} />
  {:else if looked}
    {#if reachable}
      <button
        type="button"
        class="variant-ghost btn btn-sm"
        onclick={openContact}
        data-testid="contact-person"
      >
        {name ? fill(S.reach.contactNamed, { name }) : S.reach.contact}
      </button>
    {:else}
      <p class="text-xs text-surface-500" data-testid="contact-unavailable">
        {S.reach.noContactDetails}
      </p>
    {/if}
  {/if}
{/if}
