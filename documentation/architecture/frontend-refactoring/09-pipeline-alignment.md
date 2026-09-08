# 9. Alignment with the committed pipeline

Why this programme is worth doing now rather than later, mapped to the open issues and pull requests it serves. Every row is a link to work already agreed, not a hypothetical.

## The finding that changed the plan

**All six domain coordinator zomes already emit signals, and the frontend discards every one.** `requests`, `offers`, `users_organizations`, `administration`, `service_types` and `mediums_of_exchange` each implement `post_commit` and call `emit_signal` with the same five-variant `Signal` enum. Only `misc`, which owns no entries, does not. Meanwhile `ui/src` contains no signal handling at all.

PR #181 states it from the other side: before that PR, "every coordinator zome only did local `post_commit` to `emit_signal`, a cache-invalidation bus for the agent's own UI".

That bus was built and never connected. [Proposal 5](05-conductor-signals.md) is therefore not greenfield work; it is finishing a half-built path whose expensive half is done. Phase 3 drops from three weeks to 1.5, frontend only.

## Mapping

| Committed work | Proposals it depends on | What the architecture buys |
|---|---|---|
| Chat and messaging: PR #181 (merged signalling layer), PR #188 derived mailboxes, PR #172 stewarding draft, issues #91 and #51 | 5, then 2 and 1 | Conversations are membrane-isolated DNA clones, so each open conversation is a subscription with a real lifecycle: acquire on open, release on close, re-acquire on reconnect. `Layer.scoped` models that directly. An ad hoc `client.on` callback does not, and gets it wrong on the reconnect path. Routing messages through the same event vocabulary as local writes means the conversation store reads like every other store |
| Stewarding drop: #197 case model, #198 flag intake, #199 steward queue and case screen, #200 propose-then-concur, #201 findings | 4a, 2, 3 | A tenth domain with a queue, a case screen and a conflict-of-interest read block. The queue is the clearest case for `Stale` and `Refreshing`, which `loading: boolean` cannot express. Stewarding will read users and administration, which is exactly how the third import cycle gets created. "Flag raised, case opened, steward notified" is one readable chain in coordination rather than three subscriptions in three factories |
| `@holochain/client` 0.21.0: #193, P1-critical | 5 | The signal payload field is renamed between 0.20 and 0.21. One Schema decode point makes the upgrade a one-file change. Signals wired ad hoc across the chat work first make it a sweep |
| Holochain 0.7 chain: #192 hdk 0.7, #194 kangaroo rebase, #195 network reset, #144 migration, #143 drift detection | 4a, 7 | Version drift is a state with several meanings, not a flag. The event log turns a failed migration into an exportable artifact instead of a description |
| Restore and unarchive: #161 | 4a | Another status transition on requests and offers. Each one added to a boolean-plus-error store widens the gap between representable and legal states |

## Three open bugs that are these designs, unbuilt

**#134, update then navigate produces a Wasm deserialize error.** The tester wrote: "I got impatient, I clicked update on the Request then clicked View Requests like I was exiting the edit screen." That is an in-flight effect with no owner. `E.runPromise` returns a Promise and no fiber, so nothing can interrupt it when the view goes away. [Proposal 1's Phase 0](01-application-runtime.md) exists to close exactly this class, and it is the cheapest item in the programme.

**#138, connection status reads Connected in airplane mode.** `ui/src/lib/services/connection.service.ts:83` computes `isConnected = hc.isConnected && hc.client !== null`. Neither operand changes when the network disappears, so the indicator reports an unrefuted assumption as a fact. This is [proposal 4a](04a-entity-lifecycle-states.md)'s argument in one line: a boolean cannot say "believed connected, last confirmed 40 seconds ago". The honest type is a union with a verification timestamp.

**#133, request form links and organization fields do not persist on save.** P1-critical. Silent partial failure is the class that survives when nothing forces a component to handle every state, and when a store can be `loading: false` with stale data and a null error at the same time.

## The counterweight, stated plainly

Phases 0 and 1 are 4.5 weeks. The stewarding drop and the 0.7 upgrade chain are already committed work with P1 and P2 labels on them. Doing this first delays them by that much.

The argument for doing it anyway is not that the refactor is more valuable than the features. It is that two new domains are about to be built, and each one built the current way is a debt paid twice: once now at feature speed, once later at retrofit speed. The two import cycles become four. The fifteen cross-domain subscriptions inside `hrea.store` acquire a sibling set inside a conversation store. The 21 uncancelled component calls become thirty, concentrated in chat and case screens, which are precisely the surfaces where users navigate fastest and where #134 already fired.

A defensible middle path: take Phase 0 only, which is two weeks, closes #134, and instruments everything after it. Then reassess against the stewarding drop with real evidence rather than an argument.
