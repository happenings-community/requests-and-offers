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

/** Recorded on the countered proposal, which is how its page says what happened. */
export const COUNTERED_NOTE = 'Countered with a new proposal';

export interface UseCounterProposalOptions {
  /** The proposal being countered. Null while the route parameter is unreadable. */
  agreementHash: () => ActionHash | null;
}

/**
 * Writing a counter-proposal to one proposal.
 *
 * The counter is created first and the original declined after it, so leaving
 * the form, or a failed send, leaves the original open to answer (#332).
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
      const created = await runEffect(
        exchangesStore.createAgreement(buildCounter(agreement, edits))
      );
      try {
        await runEffect(exchangesStore.respond(exchange.agreement_hash, false, COUNTERED_NOTE));
        showToast('Counter-proposal sent', 'success');
      } catch {
        showToast(
          'Your counter-proposal was sent, but the original is still open. Decline it from its page.',
          'error',
          10_000
        );
      }
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
