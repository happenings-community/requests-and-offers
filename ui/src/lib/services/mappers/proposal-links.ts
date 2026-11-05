/**
 * Which created intents a proposal publishes and which are reciprocal.
 *
 * hREA keeps both lists on the proposal entry itself, so the store creates the
 * intents first and the proposal with these ids. The mappers return their
 * intents in creation order, so the created intent at each position is the one
 * mapped there.
 */
export function proposalIntentLinks(
  mapped: ReadonlyArray<{ isReciprocal: boolean }>,
  created: ReadonlyArray<{ id: string }>
): { publishes: string[]; reciprocal: string[] } {
  if (mapped.length !== created.length) {
    throw new Error(`${mapped.length} intents mapped, ${created.length} created`);
  }
  const publishes: string[] = [];
  const reciprocal: string[] = [];
  mapped.forEach((m, i) => (m.isReciprocal ? reciprocal : publishes).push(created[i].id));
  return { publishes, reciprocal };
}
