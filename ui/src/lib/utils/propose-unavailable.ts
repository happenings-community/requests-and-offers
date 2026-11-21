/**
 * What the propose page says, and where it leads, when it cannot open.
 *
 * Pure, so every reason and its way on can be tested without mounting the page. The page
 * renders the result through the shared `ErrorState`.
 */
import type { ActionHash } from '@holochain/client';
import { paths } from '$lib/paths';
import { EXCHANGE_STRINGS } from '$lib/strings/exchanges.strings';
import type { ListingType } from '$lib/types/holochain';
import type { ErrorStateAction } from '$lib/components/shared/ErrorState.svelte';

/** Why the propose page cannot show a form. */
export type ProposeProblem =
  | { kind: 'no-listing' }
  | { kind: 'no-type' }
  | { kind: 'not-found' }
  | { kind: 'failed'; detail: string };

export type ProposeUnavailable = {
  icon: string;
  eyebrow: string;
  title: string;
  body: string;
  /** What the app reported, shown as a detail under the explanation. */
  detail?: string;
  actions: ErrorStateAction[];
  /** Whether trying the same read again could help. */
  retry: boolean;
};

const S = EXCHANGE_STRINGS.unavailable;

/** The ways on when the page cannot name the listing: where proposals carry on, then the listings. */
function waysOn(first: 'exchanges' | ListingType = 'exchanges'): ErrorStateAction[] {
  const all: Record<'exchanges' | ListingType, ErrorStateAction> = {
    exchanges: { label: S.myExchanges, href: paths.exchanges() },
    Request: { label: S.browseRequests, href: paths.requests() },
    Offer: { label: S.browseOffers, href: paths.offers() }
  };
  const order: ('exchanges' | ListingType)[] = ['exchanges', 'Request', 'Offer'];
  const sorted = [first, ...order.filter((k) => k !== first)];
  return sorted.map((k, i) => ({ ...all[k], primary: i === 0 }));
}

export function proposeUnavailable(
  problem: ProposeProblem,
  where: { listing: ActionHash | null; type: ListingType | null }
): ProposeUnavailable {
  switch (problem.kind) {
    case 'no-listing':
      return { icon: '🧭', ...S.noListing, actions: waysOn(), retry: false };
    case 'no-type':
      return { icon: '🧩', ...S.noType, actions: waysOn(), retry: false };
    case 'not-found':
      // The listing's own page would only say "not found" again, so its list instead.
      return {
        icon: '🔎',
        ...S.notFound,
        actions: waysOn(where.type ?? 'exchanges'),
        retry: false
      };
    case 'failed': {
      const { listing, type } = where;
      const actions: ErrorStateAction[] =
        listing && type
          ? [
              { label: S.backToListing, href: paths.listingDetail(listing, type), primary: true },
              { label: S.myExchanges, href: paths.exchanges() }
            ]
          : waysOn();
      return { icon: '🛠️', ...S.failed, detail: problem.detail, actions, retry: true };
    }
  }
}
