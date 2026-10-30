import type { ActionHash } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { Effect as E, Layer, Context } from 'effect';
import { MessagingError } from '$lib/errors/messaging.errors';
import { MESSAGING_CONTEXTS } from '$lib/errors/error-contexts';
import { wrapZomeCallWithErrorFactory } from '$lib/utils/zome-helpers';
import type {
  Case,
  FindSentInput,
  InboxEntry,
  Message,
  MessageRead,
  RoleCorrespondence,
  RoleRef,
  SendMessageInput,
  SendReceiptInput,
  SendRoleMessageInput,
  SentMessage
} from '$lib/schemas/messaging.schemas';

export { MessagingError };

/**
 * The `messaging` zome, one method per extern.
 *
 * This layer is a thin translation of the zome and deliberately holds no thread logic:
 * threading, counts and read markers are the store's job, because they are decisions
 * about what a member sees rather than about what the DHT holds.
 */
export interface MessagingService {
  /** One copy per recipient agent. Personal mail only; role traffic has its own call. */
  readonly sendMessage: (input: SendMessageInput) => E.Effect<SentMessage[], MessagingError>;

  /**
   * One copy to every holder of the role, to the sender, and on a reply to the member
   * who opened the case.
   *
   * Refused unless the caller may do what they are asking: writing to a role is open to
   * any accepted member, replying as the role or sending a case event is not.
   */
  readonly sendRoleMessage: (
    input: SendRoleMessageInput
  ) => E.Effect<SentMessage[], MessagingError>;

  /** Personal messages only. Every role message is kept out, for everyone. */
  readonly getInbox: () => E.Effect<InboxEntry[], MessagingError>;

  /** The nudge path: a recipient is told a hash and fetches the message itself. */
  readonly getMessage: (hash: ActionHash) => E.Effect<MessageRead, MessagingError>;

  readonly getSent: () => E.Effect<Message[], MessagingError>;

  /**
   * Is this send already on my own chain?
   *
   * **What replaces guessing after a timeout.** A lost answer says nothing about whether
   * the call committed, so the app looks instead of deciding. Bounded by `since`, so it
   * does not slow down as a member's history grows.
   */
  readonly findSent: (input: FindSentInput) => E.Effect<ActionHash | null, MessagingError>;

  /**
   * Tell every agent of one member how far this agent has read.
   *
   * A remote signal, so nothing is stored and nothing is published. If they are not
   * reachable it is dropped without an error, which is why an unchanged mark is never
   * re-sent and the same mark rides in the body of the next message instead.
   */
  readonly sendReceipt: (input: SendReceiptInput) => E.Effect<void, MessagingError>;

  /**
   * The cases addressed to this agent as a holder of the role, with each case's state
   * already worked out from its events. Refused unless the caller holds the role.
   */
  readonly getRoleInbox: (role: RoleRef) => E.Effect<Case[], MessagingError>;

  /** A member's own cases, grouped by role, for the Admin and steward area. */
  readonly getMyRoleCorrespondence: () => E.Effect<RoleCorrespondence[], MessagingError>;
}

export class MessagingServiceTag extends Context.Tag('MessagingService')<
  MessagingServiceTag,
  MessagingService
>() {}

export const MessagingServiceLive: Layer.Layer<
  MessagingServiceTag,
  never,
  HolochainClientServiceTag
> = Layer.effect(
  MessagingServiceTag,
  E.gen(function* () {
    const holochainClient = yield* HolochainClientServiceTag;

    const wrapZomeCall = <T>(fnName: string, payload: unknown, context: string) =>
      wrapZomeCallWithErrorFactory<T, MessagingError>(
        holochainClient,
        'messaging',
        fnName,
        payload,
        context,
        MessagingError.fromError
      );

    const sendMessage = (input: SendMessageInput) =>
      wrapZomeCall<SentMessage[]>('send_message', input, MESSAGING_CONTEXTS.SEND_MESSAGE);

    const getInbox = () => wrapZomeCall<InboxEntry[]>('get_inbox', null, MESSAGING_CONTEXTS.GET_INBOX);

    const getMessage = (hash: ActionHash) =>
      wrapZomeCall<MessageRead>('get_message', hash, MESSAGING_CONTEXTS.GET_MESSAGE);

    const getSent = () => wrapZomeCall<Message[]>('get_sent', null, MESSAGING_CONTEXTS.GET_SENT);

    const findSent = (input: FindSentInput) =>
      wrapZomeCall<ActionHash | null>('find_sent', input, MESSAGING_CONTEXTS.FIND_SENT);

    const sendReceipt = (input: SendReceiptInput) =>
      wrapZomeCall<void>('send_receipt', input, MESSAGING_CONTEXTS.SEND_RECEIPT);

    const sendRoleMessage = (input: SendRoleMessageInput) =>
      wrapZomeCall<SentMessage[]>(
        'send_role_message',
        input,
        MESSAGING_CONTEXTS.SEND_ROLE_MESSAGE
      );

    const getRoleInbox = (role: RoleRef) =>
      wrapZomeCall<Case[]>('get_role_inbox', role, MESSAGING_CONTEXTS.GET_ROLE_INBOX);

    const getMyRoleCorrespondence = () =>
      wrapZomeCall<RoleCorrespondence[]>(
        'get_my_role_correspondence',
        null,
        MESSAGING_CONTEXTS.GET_MY_ROLE_CORRESPONDENCE
      );

    return MessagingServiceTag.of({
      sendMessage,
      sendRoleMessage,
      getInbox,
      getMessage,
      getSent,
      findSent,
      sendReceipt,
      getRoleInbox,
      getMyRoleCorrespondence
    });
  })
);
