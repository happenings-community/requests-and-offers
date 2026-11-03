/**
 * Names for the entry and link types the inspector shows. An action only
 * carries `{ zome_index, entry_index }` or `{ zome_index, link_type }`, and no
 * admin call returns the names, so they come from source: R&O's own integrity
 * zomes, read from this repository, and hREA's from the release R&O pins
 * (`happ-0.5.0-beta.1`, scripts/download-hrea.ts).
 */

/** Variant names of `pub enum <name> { ... }` in a Rust source, in declaration order. */
export function enumVariants(source: string, name: 'EntryTypes' | 'LinkTypes'): string[] {
  const match = new RegExp(`pub enum ${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('//'))
    .map((line) => /^([A-Z][A-Za-z0-9_]*)/.exec(line)?.[1])
    .filter((v): v is string => Boolean(v));
}

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

/** Per zome index: its entry and link type names. */
export type ZomeTypes = Array<{ zome: string; entries: string[]; links: string[] }>;

/**
 * The types of a DNA's integrity zomes, in zome-index order. `readSource`
 * returns a zome's lib.rs, or null when it is not in this repository.
 */
export function zomeTypes(integrityZomes: string[], readSource: (zome: string) => string | null): ZomeTypes {
  return integrityZomes.map((zome) => {
    if (zome === 'hrea_integrity') return { zome, entries: HREA_ENTRY_TYPES, links: HREA_LINK_TYPES };
    const source = readSource(zome);
    return {
      zome,
      entries: source ? enumVariants(source, 'EntryTypes') : [],
      links: source ? enumVariants(source, 'LinkTypes') : []
    };
  });
}

export function entryTypeName(types: ZomeTypes, zomeIndex: number, entryIndex: number): string {
  return types[zomeIndex]?.entries[entryIndex] ?? `${types[zomeIndex]?.zome ?? `zome ${zomeIndex}`} #${entryIndex}`;
}

export function linkTypeName(types: ZomeTypes, zomeIndex: number, linkType: number): string {
  return types[zomeIndex]?.links[linkType] ?? `${types[zomeIndex]?.zome ?? `zome ${zomeIndex}`} link ${linkType}`;
}
