//! The rules a listing's timeframe and figures are held to (#380), and an
//! agreement's timeframe with them, as plain functions: each returns what is
//! wrong, or `None`. The zomes call them from `validate`; they read nothing, so
//! they are unit-tested without a conductor.
//!
//! **Three kinds of hours, kept apart.** A listing's `time_estimate_hours` is an
//! estimate of the time a task takes: it describes the task and is never
//! exchanged. The hours on an agreement's primary term are the service the two
//! members agree, which a proposal starts from the estimate. Hours as payment
//! are a medium of exchange (a time bank), carried by a listing's `amount` in
//! that medium's unit. Only the first is checked here as hours.

use core::time::Duration;

use hdk::prelude::*;

use crate::decimal::{decimal_problem, is_positive, Quantity};
use crate::errors::{ListingValidationError, TimeframeValidationError};
use crate::Timeframe;

/// The furthest an end date may sit after the action that writes it.
pub const MAX_DAYS_AHEAD: u64 = 365;

/// A window's `end` is after the writing action's own timestamp `at` and no more
/// than `MAX_DAYS_AHEAD` days after it; a `start`, if given, is not after the
/// `end`. A preset has nothing to check.
pub fn timeframe_problem(timeframe: &Timeframe, at: Timestamp) -> Option<TimeframeValidationError> {
  let Timeframe::Dates { start, end } = timeframe else {
    return None;
  };
  if *end <= at {
    return Some(TimeframeValidationError::EndsBeforeWritten);
  }
  // A moment too near the end of time to add a year to: refused rather than let through.
  let Some(limit) = at.checked_add(&Duration::from_secs(MAX_DAYS_AHEAD * 24 * 60 * 60)) else {
    return Some(TimeframeValidationError::EndsTooLate(MAX_DAYS_AHEAD));
  };
  if *end > limit {
    return Some(TimeframeValidationError::EndsTooLate(MAX_DAYS_AHEAD));
  }
  if let Some(start) = start {
    if start > end {
      return Some(TimeframeValidationError::StartsAfterEnd);
    }
  }
  None
}

/// A listing's time estimate, where one is given: an exact decimal, zero
/// allowed (some tasks cannot be estimated in hours, and an estimate is not a
/// quantity anyone gives).
pub fn time_estimate_problem(hours: &Option<String>) -> Option<ListingValidationError> {
  let hours = hours.as_ref()?;
  decimal_problem(hours)
    .map(|problem| ListingValidationError::TimeEstimateNotDecimal(problem.to_string()))
}

/// A listing's amount, where one is given: an exact decimal above zero, with a
/// unit. "No amount" is `None`, never zero.
pub fn amount_problem(amount: &Option<Quantity>) -> Option<ListingValidationError> {
  let amount = amount.as_ref()?;
  if let Some(problem) = decimal_problem(&amount.value) {
    return Some(ListingValidationError::AmountNotDecimal(
      problem.to_string(),
    ));
  }
  if !is_positive(&amount.value) || amount.unit.is_empty() {
    return Some(ListingValidationError::AmountInvalid);
  }
  None
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::TimeframePreset;

  const DAY: i64 = 24 * 60 * 60 * 1_000_000;

  fn at() -> Timestamp {
    Timestamp::from_micros(1_800_000_000_000_000)
  }

  fn window(start: Option<i64>, end: i64) -> Timeframe {
    Timeframe::Dates {
      start: start.map(|d| Timestamp::from_micros(at().as_micros() + d * DAY)),
      end: Timestamp::from_micros(at().as_micros() + end * DAY),
    }
  }

  #[test]
  fn every_preset_passes() {
    for p in [
      TimeframePreset::WithinAFewDays,
      TimeframePreset::WithinTwoWeeks,
      TimeframePreset::WithinAMonth,
      TimeframePreset::Flexible,
    ] {
      assert_eq!(timeframe_problem(&Timeframe::Preset(p), at()), None);
    }
  }

  #[test]
  fn a_window_with_or_without_a_start_passes() {
    assert_eq!(timeframe_problem(&window(None, 10), at()), None);
    assert_eq!(timeframe_problem(&window(Some(2), 10), at()), None);
    assert_eq!(timeframe_problem(&window(Some(10), 10), at()), None);
    assert_eq!(timeframe_problem(&window(None, 365), at()), None);
  }

  #[test]
  fn an_end_at_or_before_the_action_is_refused() {
    for end in [-1, 0] {
      assert_eq!(
        timeframe_problem(&window(None, end), at()),
        Some(TimeframeValidationError::EndsBeforeWritten),
        "an end {end} days from the action"
      );
    }
    // One microsecond after the action is after it.
    let just_after = Timeframe::Dates {
      start: None,
      end: Timestamp::from_micros(at().as_micros() + 1),
    };
    assert_eq!(timeframe_problem(&just_after, at()), None);
  }

  #[test]
  fn a_window_written_where_a_year_cannot_be_added_is_refused() {
    let at = Timestamp::from_micros(i64::MAX - 10);
    let window = Timeframe::Dates {
      start: None,
      end: Timestamp::from_micros(i64::MAX),
    };
    assert_eq!(
      timeframe_problem(&window, at),
      Some(TimeframeValidationError::EndsTooLate(MAX_DAYS_AHEAD))
    );
  }

  #[test]
  fn an_end_more_than_a_year_out_is_refused() {
    assert_eq!(
      timeframe_problem(&window(None, 366), at()),
      Some(TimeframeValidationError::EndsTooLate(MAX_DAYS_AHEAD))
    );
  }

  #[test]
  fn a_start_after_the_end_is_refused() {
    assert_eq!(
      timeframe_problem(&window(Some(11), 10), at()),
      Some(TimeframeValidationError::StartsAfterEnd)
    );
  }

  #[test]
  fn a_time_estimate_is_a_decimal_and_may_be_zero() {
    let h = |s: &str| Some(s.to_string());
    for ok in [None, h("0"), h("2.5"), h("12"), h("0.25")] {
      assert_eq!(time_estimate_problem(&ok), None, "{ok:?}");
    }
    for bad in [h("-1"), h("1e3"), h("1,5"), h(""), h("01"), h("NaN")] {
      assert!(
        matches!(
          time_estimate_problem(&bad),
          Some(ListingValidationError::TimeEstimateNotDecimal(_))
        ),
        "{bad:?}"
      );
    }
  }

  #[test]
  fn an_amount_is_a_decimal_above_zero_with_a_unit() {
    let q = |value: &str, unit: &str| {
      Some(Quantity {
        value: value.to_string(),
        unit: unit.to_string(),
      })
    };
    assert_eq!(amount_problem(&None), None);
    assert_eq!(amount_problem(&q("3", "GBP")), None);
    assert_eq!(amount_problem(&q("12.50", "Time Banking")), None);
    for bad in [q("0", "GBP"), q("0.000", "GBP"), q("3", "")] {
      assert_eq!(
        amount_problem(&bad),
        Some(ListingValidationError::AmountInvalid),
        "{bad:?}"
      );
    }
    for bad in [q("-3", "GBP"), q("abc", "GBP"), q("1e3", "GBP")] {
      assert!(
        matches!(
          amount_problem(&bad),
          Some(ListingValidationError::AmountNotDecimal(_))
        ),
        "{bad:?}"
      );
    }
  }
}
