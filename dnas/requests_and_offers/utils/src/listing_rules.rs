//! The rules every listing and agreement shares, as plain functions:
//! each returns what is wrong, or `None`. The zomes call them from their
//! `validate`; they read nothing, so they are unit-tested without a conductor.

use core::time::Duration;

use hdk::prelude::*;

use crate::{Quantity, Timeframe};

/// The furthest an end date may sit after the action that writes it.
pub const MAX_DAYS_AHEAD: u64 = 365;

/// A window's `end` is after the writing action's own timestamp `at` and no
/// more than a year after it; a `start`, if given, is not after the `end`. A
/// preset has nothing to check.
pub fn timeframe_problem(timeframe: &Timeframe, at: Timestamp) -> Option<String> {
  let Timeframe::Dates { start, end } = timeframe else {
    return None;
  };
  if *end <= at {
    return Some("a timeframe must end after the moment it is written".to_string());
  }
  let limit = at.checked_add(&Duration::from_secs(MAX_DAYS_AHEAD * 24 * 60 * 60))?;
  if *end > limit {
    return Some(format!("a timeframe must end within {MAX_DAYS_AHEAD} days of being written"));
  }
  if let Some(start) = start {
    if start > end {
      return Some("a timeframe must not start after it ends".to_string());
    }
  }
  None
}

/// Hours on a listing: a finite figure, zero or more.
pub fn hours_problem(hours: Option<f32>) -> Option<String> {
  let hours = hours?;
  if !hours.is_finite() {
    return Some("hours must be a finite number".to_string());
  }
  if hours < 0.0 {
    return Some("hours cannot be negative".to_string());
  }
  None
}

/// An amount, where one is given: finite and above zero, with a unit. "No
/// figure" is `None`, never zero.
pub fn amount_problem(amount: &Option<Quantity>) -> Option<String> {
  let amount = amount.as_ref()?;
  if !(amount.value.is_finite() && amount.value > 0.0) || amount.unit.is_empty() {
    return Some("an amount must be a finite figure above zero, with a unit".to_string());
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
    assert!(timeframe_problem(&window(None, -1), at()).unwrap().contains("must end after"));
    assert!(timeframe_problem(&window(None, 0), at()).unwrap().contains("must end after"));
  }

  #[test]
  fn an_end_more_than_a_year_out_is_refused() {
    assert!(timeframe_problem(&window(None, 366), at()).unwrap().contains("365 days"));
  }

  #[test]
  fn a_start_after_the_end_is_refused() {
    assert!(timeframe_problem(&window(Some(11), 10), at()).unwrap().contains("must not start after"));
  }

  #[test]
  fn hours_are_finite_and_not_negative() {
    assert_eq!(hours_problem(None), None);
    assert_eq!(hours_problem(Some(0.0)), None);
    assert_eq!(hours_problem(Some(2.5)), None);
    assert!(hours_problem(Some(-1.0)).unwrap().contains("cannot be negative"));
    assert!(hours_problem(Some(f32::NAN)).unwrap().contains("finite"));
    assert!(hours_problem(Some(f32::INFINITY)).unwrap().contains("finite"));
  }

  #[test]
  fn an_amount_is_finite_positive_with_a_unit() {
    let q = |value: f64, unit: &str| Some(Quantity { value, unit: unit.to_string() });
    assert_eq!(amount_problem(&None), None);
    assert_eq!(amount_problem(&q(3.0, "hours")), None);
    for bad in [q(0.0, "hours"), q(-3.0, "hours"), q(f64::NAN, "hours"), q(f64::INFINITY, "hours"), q(3.0, "")] {
      assert!(amount_problem(&bad).unwrap().contains("above zero"));
    }
  }
}
