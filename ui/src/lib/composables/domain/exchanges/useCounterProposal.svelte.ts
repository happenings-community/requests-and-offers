import type { ActionHash } from '@holochain/client';
import exchangesStore from '$lib/stores/exchanges.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils/toast';
import {
  buildCounter,
  changedFields,
  counterProblem,
  reciprocalFigure,
  startingEdits,
  timeframeOptions
} from '$lib/utils/counter-proposal';
import { useExchangeDetails } from './useExchangeDetails.svelte';

/**
 * The note the zome records on the proposal a counter declines (`COUNTERED_NOTE`
 * in the exchanges coordinator). The chain itself is read from `counters`, not
 * from this wording.
 */
export const COUNTERED_NOTE = 'Countered with a new proposal';

export interface UseCounterProposalOptions {
  /** The proposal being countered. Null while the route parameter is unreadable. */
  agreementHash: () => ActionHash | null;
}

/**
 * Writing a counter-proposal to one proposal.
 *
 * Nothing is written until the member sends, so leaving the form leaves the
 * original open. Sending is one zome call that declines the original and
 * writes the counter together (#332, #333).
 */
export function useCounterProposal(options: UseCounterProposalOptions) {
  const details = useExchangeDetails(options);

  let primary = $state<number | null | undefined>(null);
  let reciprocal = $state<number | null | undefined>(null);
  let timeframe = $state('');
  let seeded = $state(false);
  let sending = $state(false);

  const exchange = $derived(details.exchange);
  const agreement = $derived(exchange?.agreement ?? null);

  /** Only the member a proposal was sent to can counter it, and only while it is open. */
  const canCounter = $derived(
    !!exchange && !!details.role && exchange.status === 'Proposed' && !details.iWroteIt
  );
  const figure = $derived(agreement ? reciprocalFigure(agreement.reciprocal) : null);
  const edits = $derived({ primary, reciprocal, timeframe });
  const changed = $derived(agreement ? changedFields(agreement, edits) : []);
  const problem = $derived(agreement ? counterProblem(agreement, edits) : null);
  const timeframes = $derived(agreement ? timeframeOptions(agreement.delivery_timeframe) : []);

  /** Fills the form from the proposal once, so a re-read never wipes what was typed. */
  function seed() {
    if (seeded || !agreement) return;
    const start = startingEdits(agreement);
    primary = start.primary;
    reciprocal = start.reciprocal;
    timeframe = start.timeframe;
    seeded = true;
  }

  async function initialize(): Promise<void> {
    await details.initialize();
    seed();
  }

  /** Sends the counter and declines the original. Returns the new proposal's hash. */
  async function send(): Promise<ActionHash | null> {
    if (!exchange || !agreement || !canCounter || sending) return null;
    if (problem) {
      showToast(problem, 'error');
      return null;
    }
    sending = true;
    try {
      // One call: the zome declines the original and writes the counter in the
      // same commit, so neither can exist without the other (#333). A plain
      // copy, because a state proxy cannot be cloned into the zome call.
      const created = await runEffect(
        exchangesStore.counter(
          buildCounter(
            $state.snapshot(exchange.agreement_hash),
            $state.snapshot(agreement),
            $state.snapshot(edits)
          )
        )
      );
      showToast('Counter-proposal sent', 'success');
      return created.agreement_hash;
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error');
      return null;
    } finally {
      sending = false;
    }
  }

  return {
    get exchange() {
      return exchange;
    },
    get other() {
      return details.other;
    },
    get listingTitle() {
      return details.listingTitle;
    },
    get loadError() {
      return details.loadError;
    },
    get role() {
      return details.role;
    },
    get canCounter() {
      return canCounter;
    },
    get figure() {
      return figure;
    },
    get changed() {
      return changed;
    },
    get problem() {
      return problem;
    },
    get timeframes() {
      return timeframes;
    },
    get sending() {
      return sending;
    },
    get primary() {
      return primary;
    },
    set primary(value: number | null | undefined) {
      primary = value;
    },
    get reciprocal() {
      return reciprocal;
    },
    set reciprocal(value: number | null | undefined) {
      reciprocal = value;
    },
    get timeframe() {
      return timeframe;
    },
    set timeframe(value: string) {
      timeframe = value;
    },
    initialize,
    send
  };
}

export type CounterProposal = ReturnType<typeof useCounterProposal>;
