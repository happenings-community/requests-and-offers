use hdi::prelude::*;

/// A message stored on the shared DNA, encrypted for one recipient agent.
///
/// Nothing but the ciphertext and its nonce is in the entry. The conversation it
/// belongs to is inside the encrypted payload, not beside it, so the DHT does not
/// carry the grouping. What the DHT does carry, for the life of the network, is the
/// action: author, recipient (via the `Inbox` link base) and timestamp. That is a
/// deliberate trade recorded in the brief, not an oversight.
#[derive(Clone, PartialEq)]
#[hdk_entry_helper]
pub struct EncryptedMessage {
  pub encrypted: XSalsa20Poly1305EncryptedData,
}

/// Largest ciphertext this zome will accept, derived from the plaintext bounds the
/// coordinator enforces rather than picked for roundness.
///
/// The plaintext is a msgpack map, and the worst case is a **role message**: `content`
/// at `MAX_CONTENT_BYTES` (16 KiB), a `send_id` at `MAX_SEND_ID_BYTES` (64), a role
/// reference whose largest form is a named permission at `MAX_PERMISSION_BYTES` (64), a
/// direction, and a case reference carrying a `case_id` at `MAX_CASE_ID_BYTES` (64), the
/// opener's `User` hash, a kind, and an event whose largest form holds one more
/// `ActionHash`.
///
/// Adding msgpack's camelCase field names and length prefixes, that is about 16,803
/// bytes, and crypto_box adds a 16-byte authentication tag: **about 16,819 against the
/// 17,408 below, leaving roughly 580 bytes spare.** The nonce is a separate fixed-size
/// field of `XSalsa20Poly1305EncryptedData` and is not counted here.
///
/// A personal message is far smaller, and the two fields brief E adds to it cannot both
/// grow: `listing` is only ever set on a card-only message, whose `content` is empty,
/// which `send_message` enforces. `read_up_to` is a timestamp.
///
/// The constant has not moved since it was first derived from a conversation ID and a
/// content bound. Each reshape since has fitted inside it, which is why no message that
/// used to fit has ever stopped fitting.
///
/// 17 KiB leaves a few hundred bytes of headroom for the encoding rather than
/// sitting exactly on the arithmetic, because a validation rule that rejects a
/// legitimate message is worse than one that accepts a slightly larger one.
pub const MAX_CIPHERTEXT_BYTES: usize = 17 * 1024;

// -- the rules, as pure functions --
//
// Each validation rule is a decision about values, separated from the lookups that
// fetch them. That is what makes them testable: `validate` cannot be unit-tested
// without constructing an `Op`, and nothing a member can call can produce an invalid
// one, so these functions are where the rules are actually proven.

/// A ciphertext is valid if it is within the bound.
pub fn check_ciphertext_size(len: usize) -> ValidateCallbackResult {
  if len > MAX_CIPHERTEXT_BYTES {
    return ValidateCallbackResult::Invalid(format!(
      "Encrypted message is {len} bytes, over the {MAX_CIPHERTEXT_BYTES} byte limit"
    ));
  }
  ValidateCallbackResult::Valid
}

/// Only the author of a thing may delete it.
pub fn check_deleter_is_author(
  deleter: &AgentPubKey,
  original_author: &AgentPubKey,
) -> ValidateCallbackResult {
  if deleter != original_author {
    return ValidateCallbackResult::Invalid(
      "Only the author of an entry may delete it".to_string(),
    );
  }
  ValidateCallbackResult::Valid
}

/// An `Inbox` link must be authored by the author of the message it points at.
///
/// Without this, any agent could link somebody else's message into a third party's
/// inbox, and the recipient would see a message the apparent sender never addressed to
/// them.
pub fn check_link_author_matches_message(
  link_author: &AgentPubKey,
  message_author: &AgentPubKey,
) -> ValidateCallbackResult {
  if link_author != message_author {
    return ValidateCallbackResult::Invalid(
      "An Inbox link must be authored by the author of the message it points to".to_string(),
    );
  }
  ValidateCallbackResult::Valid
}

/// Only the author of an `Inbox` link may delete it.
///
/// The recipient must not be able to delete the sender's link: that would destroy the
/// sender's own record of what they sent. A recipient who does not want to see a
/// message hides it with a private marker instead.
pub fn check_link_deleter_is_author(
  deleter: &AgentPubKey,
  link_author: &AgentPubKey,
) -> ValidateCallbackResult {
  if deleter != link_author {
    return ValidateCallbackResult::Invalid(
      "Only the author of an Inbox link may delete it".to_string(),
    );
  }
  ValidateCallbackResult::Valid
}

pub fn validate_encrypted_message(message: EncryptedMessage) -> ExternResult<ValidateCallbackResult> {
  Ok(check_ciphertext_size(
    message.encrypted.as_encrypted_data_ref().len(),
  ))
}

#[cfg(test)]
mod tests {
  use super::*;

  fn key(byte: u8) -> AgentPubKey {
    AgentPubKey::from_raw_36(vec![byte; 36])
  }

  /// Assert a rule accepted, and say what it returned if it did not.
  ///
  /// These helpers exist because a bare `assert!` prints only its own source text. When
  /// one of these fires in CI months from now, the line that fires should say what it
  /// expected and what it got, without anyone having to re-read the test.
  fn assert_valid(result: ValidateCallbackResult, what: &str) {
    assert!(
      matches!(result, ValidateCallbackResult::Valid),
      "{what} should be valid, got {result:?}"
    );
  }

  /// Assert a rule refused, and that its reason mentions `expected_in_reason`.
  ///
  /// Checking the reason matters as much as checking the refusal: a rule that rejects
  /// everything would pass a refusal-only assertion.
  fn assert_invalid(result: ValidateCallbackResult, what: &str, expected_in_reason: &str) {
    match result {
      ValidateCallbackResult::Invalid(why) => assert!(
        why.contains(expected_in_reason),
        "{what} was refused, but the reason should mention {expected_in_reason:?}; got {why:?}"
      ),
      other => panic!("{what} should have been refused, got {other:?}"),
    }
  }

  #[test]
  fn ciphertext_at_the_bound_is_valid_and_one_byte_over_is_not() {
    assert_valid(check_ciphertext_size(0), "an empty ciphertext");
    assert_valid(
      check_ciphertext_size(MAX_CIPHERTEXT_BYTES),
      "a ciphertext exactly at the bound",
    );
    assert_invalid(
      check_ciphertext_size(MAX_CIPHERTEXT_BYTES + 1),
      "a ciphertext one byte over the bound",
      "over the",
    );
  }

  #[test]
  fn only_the_author_may_delete_an_entry() {
    let author = key(1);
    let someone_else = key(2);

    assert_valid(
      check_deleter_is_author(&author, &author),
      "an author deleting their own entry",
    );
    assert_invalid(
      check_deleter_is_author(&someone_else, &author),
      "another agent deleting someone else's entry",
      "Only the author",
    );
  }

  #[test]
  fn an_inbox_link_must_come_from_the_message_author() {
    let sender = key(1);
    let interloper = key(2);

    assert_valid(
      check_link_author_matches_message(&sender, &sender),
      "a sender linking their own message",
    );
    // The case that matters: someone links another agent's message into an inbox.
    assert_invalid(
      check_link_author_matches_message(&interloper, &sender),
      "an interloper linking another agent's message",
      "authored by the author",
    );
  }

  #[test]
  fn only_the_link_author_may_delete_the_link() {
    let sender = key(1);
    let recipient = key(2);

    assert_valid(
      check_link_deleter_is_author(&sender, &sender),
      "a sender deleting their own Inbox link",
    );
    // The recipient deleting the sender's link is the case this rule exists for.
    assert_invalid(
      check_link_deleter_is_author(&recipient, &sender),
      "a recipient deleting the sender's Inbox link",
      "Only the author of an Inbox link",
    );
  }
}
