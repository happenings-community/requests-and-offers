/**
 * Everything the inspector knows about one hApp, in one place. The core
 * (inspector-server, inspector-graph, inspector-view, inspector-types and the
 * page) reads roles, cells, actions and links from the conductor and knows no
 * app; an adapter adds what the conductor cannot give: the names of entry and
 * link types (an action carries only their indexes), labels for the roles,
 * the page's title and the role it opens on. Without one, the inspector still
 * works and shows types by index (`genericAdapter`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enumVariants, type ZomeNames } from './inspector-types.mts';

export type InspectorAdapter = {
  title: string;
  /** Per role name, as the hApp manifest calls it: a label and an optional colour. */
  roles: Record<string, { label: string; colour?: string }>;
  /** The role the entry graph opens on; the first role otherwise. */
  defaultRole?: string;
  zomeNames: ZomeNames;
};

/** What the page is sent: the adapter without its functions. */
export type InspectorConfig = Omit<InspectorAdapter, 'zomeNames'>;

export const genericAdapter: InspectorAdapter = { title: 'Conductor inspector', roles: {}, zomeNames: () => null };

export function roleLabel(adapter: Pick<InspectorAdapter, 'roles'>, role: string): string {
  return adapter.roles[role]?.label ?? role;
}

export function configOf(adapter: InspectorAdapter): InspectorConfig {
  const { zomeNames: _names, ...config } = adapter;
  return config;
}

// ---- Requests and Offers --------------------------------------------------

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** hREA happ-0.5.0-beta.1, dnas/hrea/zomes/integrity/hrea/src/lib.rs. */
export const HREA_ENTRY_TYPES = [
  'Agent', 'Agreement', 'ProcessSpecification', 'Plan', 'Process', 'Unit', 'ResourceSpecification',
  'RecipeProcess', 'RecipeExchange', 'Proposal', 'RecipeFlow', 'Commitment', 'Intent',
  'EconomicResource', 'EconomicEvent', 'Claim', 'SpatialThing', 'AgreementBundle'
];

export const HREA_LINK_TYPES = [
  'ReaAgentUpdates', 'AllAgents', 'ReaAgreementUpdates', 'AllAgreements', 'ReaProcessSpecificationUpdates',
  'AllProcessSpecifications', 'ReaPlanUpdates', 'AllPlans', 'ReaProcessSpecificationToReaProcesses',
  'ReaPlanToReaProcesses', 'ReaProcessUpdates', 'AllProcesses', 'ReaUnitUpdates', 'AllUnits',
  'ReaResourceSpecificationUpdates', 'AllResourceSpecifications', 'ReaRecipeProcessUpdates', 'AllRecipeProcesses',
  'ReaRecipeExchangeUpdates', 'AllRecipeExchanges', 'ReaProposalUpdates', 'AllProposals',
  'ReaRecipeExchangeToReaRecipeFlows', 'ReaRecipeExchangeToReaRecipeFlowsReciprocal',
  'ReaRecipeProcessToReaRecipeFlowInputs', 'ReaRecipeProcessToReaRecipeFlowOutputs', 'ReaRecipeFlowUpdates',
  'ReaProcessToInputs', 'ReaProcessToOutputs', 'ProviderToReaCommitments', 'ReceiverToReaCommitments',
  'ReaAgreementToReaCommitments', 'ReaPlanToReaCommitments', 'ReaPlanToIndependentDemands', 'ReaCommitmentUpdates',
  'ReaProcessToReaIntentInputs', 'ReaProcessToReaIntentOutputs', 'ProviderToReaIntents', 'ReceiverToReaIntents',
  'ReaIntentUpdates', 'ReaEconomicResourceToReaEconomicResources', 'ReaEconomicResourceUpdates',
  'AllEconomicResources', 'ReaProcessToReaEconomicEventInputs', 'ReaProcessToReaEconomicEventOutputs',
  'ProviderToReaEconomicEvents', 'ReceiverToReaEconomicEvents', 'ReaAgreementToReaEconomicEvents',
  'ReaEconomicEventToReaEconomicEvents', 'ReaEconomicEventUpdates', 'AllEconomicEvents',
  'ReaEconomicResourceToReaEconomicEvents', 'CommitmentToFulfillingEconomicEvents', 'IntentToSatisfyingCommitments',
  'IntentToSatisfyingEconomicEvents', 'ReaClaimUpdates', 'AllClaims', 'ReaSpatialThingUpdates', 'AllSpatialThings',
  'ReaAgreementBundleUpdates', 'AllAgreementBundles', 'AllCommitments', 'AllIntents', 'AllRecipeFlows',
  'ClaimToSettlingEvents'
];

/** An R&O integrity zome's lib.rs, from this repository. */
function roZomeSource(zome: string): string | null {
  const file = join(ROOT, 'dnas', 'requests_and_offers', 'zomes', 'integrity', zome.replace(/_integrity$/, ''), 'src', 'lib.rs');
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

/** R&O's own types from its integrity zomes' source; hREA's from the release R&O pins. */
export const roAdapter: InspectorAdapter = {
  title: 'R&O conductor inspector',
  roles: {
    requests_and_offers: { label: 'Requests & Offers', colour: '#4720b7' },
    hrea: { label: 'hREA', colour: '#0ea5e9' }
  },
  defaultRole: 'requests_and_offers',
  zomeNames: (zome) => {
    if (zome === 'hrea_integrity') return { entries: HREA_ENTRY_TYPES, links: HREA_LINK_TYPES };
    const source = roZomeSource(zome);
    return source ? { entries: enumVariants(source, 'EntryTypes'), links: enumVariants(source, 'LinkTypes') } : null;
  }
};
