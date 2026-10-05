import { Schema } from 'effect';
import { ActionHashSchema, AgentPubKeySchema, TimestampSchema } from './holochain.schemas';

/**
 * Messaging schemas.
 *
 * These mirror the `messaging` coordinator zome in
 * `dnas/requests_and_offers/zomes/coordinator/messaging/`, as it stands at `c334baef`
 * (#304, role messages and cases). Where the zome's casing is inconsistent this file
 * follows the zome rather than tidying it, because the wire format is the contract and a
 * tidier name here would simply fail at runtime.
 *
 * **Absent is not null, and the zome uses both.** A Rust field marked
 * `skip_serializing_if = "Option::is_none"` is *missing* from the payload when it is
 * `None`; one without it arrives as msgpack nil, which decodes to `null`. They need
 * `Schema.optional` and `Schema.NullOr` respectively, and swapping them fails only at
 * runtime. Each field below says which it is.
 *
 * Everything the zome exposes is `rename_all = "camelCase"`. The one exception used to
 * be `ReadMarker`, a bare entry helper taking snake_case; it is gone, along with blocks,
 * because a private entry hides its content but not its timing. Both now live in this
 * member's own local state.
 *
 * Timestamps are Holochain microseconds, not milliseconds. Dividing by 1000 before
 * handing one to `Date` is the caller's job and `toDate` below is the one place that
 * should do it.
 */

// ============================================================================
// PRIMITIVES
// ============================================================================

/**
 * Which role a message is addressed to, or sent as.
 *
 * Internally tagged by the zome, so `Admin` is `{ type: 'admin' }`. Only `admin` is
 * switched on; the zome refuses the other two with "not enabled yet" until briefs C
 * and D, and they are here so the interface does not have to change when it stops.
 */
export const RoleRefSchema = Schema.Union(
  Schema.Struct({ type: Schema.Literal('admin') }),
  Schema.Struct({ type: Schema.Literal('permission'), name: Schema.String }),
  Schema.Struct({ type: Schema.Literal('orgCoordinator'), organization: ActionHashSchema })
).annotations({
  title: 'Role Reference',
  description: 'Which role a message is addressed to, or sent as'
});
export type RoleRef = Schema.Schema.Type<typeof RoleRefSchema>;

/** The admin role, the only one alpha 2 switches on. */
export const ADMIN_ROLE: RoleRef = { type: 'admin' };

/**
 * Which way a role message travels.
 *
 * **A label, never an authorisation.** The zome derives it at send and does not trust it
 * on read: whether a message acts as a role is decided from its author against the
 * case's opener. The interface may use it for grouping and nothing else.
 */
export const RoleDirectionSchema = Schema.Literal('toHolders', 'fromHolder');
export type RoleDirection = Schema.Schema.Type<typeof RoleDirectionSchema>;

/** What a case is about. Service type and medium suggestions follow later. */
export const CaseKindSchema = Schema.Literal('technicalReport');
export type CaseKind = Schema.Schema.Type<typeof CaseKindSchema>;

/** How a case ended. */
export const CaseOutcomeSchema = Schema.Literal('resolved', 'dismissed');
export type CaseOutcome = Schema.Schema.Type<typeof CaseOutcomeSchema>;

/**
 * Something a holder did to a case. Internally tagged, like `RoleRef`.
 *
 * A note's text is the message's `content`, not a field here, which is why `caseNote`,
 * `complete` and `reopen` carry no note of their own.
 */
export const CaseEventSchema = Schema.Union(
  Schema.Struct({ type: Schema.Literal('claim') }),
  Schema.Struct({ type: Schema.Literal('release') }),
  Schema.Struct({ type: Schema.Literal('handOverOffer'), to: ActionHashSchema }),
  Schema.Struct({ type: Schema.Literal('handOverAccept') }),
  Schema.Struct({ type: Schema.Literal('caseNote') }),
  Schema.Struct({ type: Schema.Literal('complete'), outcome: CaseOutcomeSchema }),
  Schema.Struct({ type: Schema.Literal('reopen') })
);
export type CaseEvent = Schema.Schema.Type<typeof CaseEventSchema>;

/**
 * Which case a role message belongs to.
 *
 * **Keyed by `opener` and `caseId` together**, never the ID alone: the sender chooses the
 * ID, so two members who pick the same one have two separate cases.
 */
export const CaseRefSchema = Schema.Struct({
  caseId: Schema.String,
  opener: ActionHashSchema,
  kind: CaseKindSchema,
  /** Absent (`skip_serializing_if`) for an ordinary message on the case. */
  event: Schema.optional(CaseEventSchema)
});
export type CaseRef = Schema.Schema.Type<typeof CaseRefSchema>;

/** Holochain timestamps are microseconds; `Date` wants milliseconds. */
export const toDate = (timestamp: number): Date => new Date(Math.floor(timestamp / 1000));

// ============================================================================
// MESSAGES
// ============================================================================

/** A decrypted message, as `get_inbox`, `get_message` and `get_sent` return it. */
export class Message extends Schema.Class<Message>('Message')({
  hash: ActionHashSchema,
  /** The author, read from the action rather than the payload, so it cannot be forged. */
  from: AgentPubKeySchema,
  /** The agent this copy was encrypted to. */
  to: AgentPubKeySchema,
  at: TimestampSchema,
  content: Schema.String,
  /** Matches copies of one message. Empty on anything written before send ids. */
  sendId: Schema.optionalWith(Schema.String, { default: () => '' }),
  /** How far the sender has read in this conversation, if they are telling. */
  readUpTo: Schema.optional(TimestampSchema),
  /** A listing published from this conversation, on a card-only message. */
  listing: Schema.optional(ActionHashSchema),
  /**
   * Absent on a personal message (`skip_serializing_if`). Its presence is the whole
   * separation: the zome keeps every message that has one out of `get_inbox`.
   */
  role: Schema.optional(RoleRefSchema),
  /** Absent likewise. A label for grouping, never an authorisation. */
  direction: Schema.optional(RoleDirectionSchema),
  /** Absent likewise. */
  case: Schema.optional(CaseRefSchema)
}) {}

/**
 * One inbox item.
 *
 * `Unreadable` is a *fault*, not a filter: every inbox link points at a message
 * encrypted to this agent, so one that will not decrypt means something is wrong. It is
 * surfaced as a fault row rather than dropped, and it is deliberately not counted as
 * new.
 */
export const InboxEntrySchema = Schema.Union(
  Schema.Struct({ type: Schema.Literal('Read') }).pipe(Schema.extend(Message)),
  Schema.Struct({
    type: Schema.Literal('Unreadable'),
    hash: ActionHashSchema,
    from: AgentPubKeySchema,
    at: TimestampSchema
  })
);
export type InboxEntry = Schema.Schema.Type<typeof InboxEntrySchema>;

/**
 * What `get_message` reports.
 *
 * The four outcomes are kept apart on purpose, and the store treats each differently:
 * `NotFound` means the entry has not reached this agent yet, `Unreadable` means it is
 * held but will not decrypt, and only the second is evidence about the encryption.
 * Collapsing them would make the nudge path guess.
 */
export const MessageReadSchema = Schema.Union(
  Schema.Struct({ type: Schema.Literal('NotFound') }),
  Schema.Struct({ type: Schema.Literal('Withheld') }),
  Schema.Struct({ type: Schema.Literal('Unreadable') }),
  Schema.Struct({ type: Schema.Literal('Read') }).pipe(Schema.extend(Message))
);
export type MessageRead = Schema.Schema.Type<typeof MessageReadSchema>;

/** One recipient agent's copy, as `send_message` reports it back. */
export class SentMessage extends Schema.Class<SentMessage>('SentMessage')({
  agent: AgentPubKeySchema,
  hash: ActionHashSchema
}) {}

/**
 * What `send_message` takes.
 *
 * `toUser` is the recipient's `User` original action hash, not an agent key: a member
 * may run several agents and the zome encrypts one copy per agent.
 */
export class SendMessageInput extends Schema.Class<SendMessageInput>('SendMessageInput')({
  toUser: ActionHashSchema,
  content: Schema.String,
  /** This send's identity, kept across retries so no copy is ever shown twice. */
  sendId: Schema.String,
  readUpTo: Schema.optional(TimestampSchema),
  /** Only valid with empty `content`: the zome refuses a message carrying both. */
  listing: Schema.optional(ActionHashSchema)
}) {}

/** What `find_sent` is asked: is this send already on my own chain? */
export class FindSentInput extends Schema.Class<FindSentInput>('FindSentInput')({
  sendId: Schema.String,
  /** Only look from here onwards, which is when the outbox item was created. */
  since: TimestampSchema
}) {}

/** What `send_receipt` is asked: tell this member how far I have read. */
export class SendReceiptInput extends Schema.Class<SendReceiptInput>('SendReceiptInput')({
  toUser: ActionHashSchema,
  readUpTo: TimestampSchema
}) {}

/**
 * What `send_role_message` takes.
 *
 * `opener` and `event` are omitted rather than sent as null when absent, matching the
 * zome's `skip_serializing_if`. Leaving `opener` out means "my own case", which is how a
 * case is opened and how a member follows one up; naming somebody else's means acting as
 * the role, which the zome refuses unless the caller holds it.
 */
export class SendRoleMessageInput extends Schema.Class<SendRoleMessageInput>(
  'SendRoleMessageInput'
)({
  role: RoleRefSchema,
  content: Schema.String,
  caseId: Schema.String,
  kind: CaseKindSchema,
  opener: Schema.optional(ActionHashSchema),
  event: Schema.optional(CaseEventSchema)
}) {}

// ============================================================================
// CASES
// ============================================================================

/** An offer of a case that nobody has accepted yet. */
export const HandOverSchema = Schema.Struct({
  offeredBy: AgentPubKeySchema,
  to: ActionHashSchema,
  at: TimestampSchema
});
export type HandOver = Schema.Schema.Type<typeof HandOverSchema>;

/** How and when a case was closed. */
export const CaseClosureSchema = Schema.Struct({
  outcome: CaseOutcomeSchema,
  at: TimestampSchema
});
export type CaseClosure = Schema.Schema.Type<typeof CaseClosureSchema>;

/**
 * One case, with its state worked out by the zome from its events.
 *
 * **Nothing stores a case's state.** It is a fold over the events, so every holder
 * computes the same answer and there is no second writer. That is what replaced the
 * per-administrator private resolution #301 had.
 *
 * `closed` and `pendingHandOver` are nullable rather than optional: the zome does not
 * mark them `skip_serializing_if`, so they arrive as nil and decode to `null`.
 */
export class Case extends Schema.Class<Case>('Case')({
  caseId: Schema.String,
  opener: ActionHashSchema,
  kind: CaseKindSchema,
  openedAt: TimestampSchema,
  /** Every message and event on the case, oldest first. */
  messages: Schema.Array(Message),
  /**
   * Every holder with a claim standing, by agent key. Several may stand at once: a
   * claim informs and never blocks, so "Claimed by Anita and by you" is the normal case.
   */
  claimedBy: Schema.Array(AgentPubKeySchema),
  closed: Schema.NullOr(CaseClosureSchema),
  pendingHandOver: Schema.NullOr(HandOverSchema)
}) {}

/** One role's worth of a member's own cases. */
export class RoleCorrespondence extends Schema.Class<RoleCorrespondence>('RoleCorrespondence')({
  role: RoleRefSchema,
  cases: Schema.Array(Case)
}) {}

/**
 * The structured body of a technical report.
 *
 * Encoded as JSON into a message's `content`, so a report carries machine-readable
 * detail without needing a second entry type. `version` is first so that a later shape
 * can be told apart from this one; if decoding fails the admin page shows the raw text
 * rather than hiding the report.
 */
export class ReportContent extends Schema.Class<ReportContent>('ReportContent')({
  version: Schema.Literal(1),
  /** The message that could not be opened. */
  faultHash: Schema.String,
  faultFrom: Schema.String,
  faultAt: TimestampSchema,
  note: Schema.String
}) {}

// ============================================================================
// SIGNALS
// ============================================================================

/**
 * The nudge, as the `messaging` zome emits it.
 *
 * A nudge carries one `ActionHash` and never content: the hash names data the recipient
 * fetches for itself under that data's own rules. `from` comes from call provenance, so
 * a sender cannot forge it. A nudge is timeliness only, never the delivery guarantee,
 * so a missed one costs a later read and nothing more.
 */
export const MessagingSignalSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal('Nudge'),
    hash: ActionHashSchema,
    from: AgentPubKeySchema
  }),
  /**
   * Somebody says they have read up to here.
   *
   * **Leaves no record anywhere.** A receipt is a remote signal, not an entry, because
   * an entry would publish its action and the action's timestamp and type would say who
   * read whose message and when, to anyone watching. `from` is call provenance and
   * cannot be forged; `readUpTo` is a claim, and the app clamps it to what it actually
   * sent that person.
   */
  Schema.Struct({
    type: Schema.Literal('Receipt'),
    readUpTo: TimestampSchema,
    from: AgentPubKeySchema
  })
);
export type MessagingSignal = Schema.Schema.Type<typeof MessagingSignalSchema>;
