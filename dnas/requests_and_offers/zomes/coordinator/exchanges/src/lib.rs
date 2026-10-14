//! Exchange record: the coordination layer of an exchange between two members.
//!
//! Interest, agreement, response, completion, review and cancellation, all
//! append-only; state is read from which of them exist. See
//! documentation/architecture/EXCHANGE_RECORD.md.

pub mod exchange;
pub mod external_calls;

pub use exchange::*;
