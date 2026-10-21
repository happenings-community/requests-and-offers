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

/// The longest link a listing or organisation may carry.
pub const MAX_LINK_LENGTH: usize = 2048;

/// Links a member typed on a listing or an organisation: each one a web
/// address. Other members' apps open these, so a `javascript:` or `data:`
/// "link" would run as code in the reader's window. An address that names a
/// scheme must name `http` or `https`; a bare address (`example.org/about`)
/// names none and is opened as `https://`. Spaces and control characters are
/// refused anywhere inside, since a browser drops some of them before reading
/// the scheme (`java\tscript:`).
pub fn links_problem(links: &[String]) -> Option<String> {
  links.iter().find_map(|link| link_problem(link))
}

fn link_problem(link: &str) -> Option<String> {
  let link = link.trim();
  if link.len() > MAX_LINK_LENGTH {
    return Some(format!("a link cannot exceed {MAX_LINK_LENGTH} characters"));
  }
  if link.chars().any(|c| c.is_whitespace() || c.is_control()) {
    return Some("a link cannot contain spaces or control characters".to_string());
  }
  let scheme = scheme_of(link)?.to_ascii_lowercase();
  if scheme != "http" && scheme != "https" {
    return Some("a link must be a web address (http or https)".to_string());
  }
  None
}

/// The scheme a browser would read: the text before the first `:`, when that
/// text is a letter followed by letters, digits, `+`, `-` or `.`.
fn scheme_of(link: &str) -> Option<&str> {
  let (scheme, _) = link.split_once(':')?;
  let mut chars = scheme.chars();
  let first = chars.next()?;
  let rest_ok = chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.'));
  (first.is_ascii_alphabetic() && rest_ok).then_some(scheme)
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

  fn links(list: &[&str]) -> Vec<String> {
    list.iter().map(|l| l.to_string()).collect()
  }

  #[test]
  fn web_addresses_pass() {
    let good = links(&[
      "https://example.org",
      "http://example.org/a?b=c#d",
      "HTTPS://Example.org",
      "  https://example.org  ",
      "example.org",
      "www.example.org/about",
      "example.org/a:b",
    ]);
    assert_eq!(links_problem(&good), None);
    assert_eq!(links_problem(&[]), None);
  }

  #[test]
  fn other_schemes_are_refused() {
    for bad in [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      " javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "mailto:someone@example.org",
      "example.org:8080",
    ] {
      let reason = links_problem(&links(&["https://example.org", bad])).expect(bad);
      assert!(reason.contains("web address"), "{bad}: {reason}");
    }
  }

  #[test]
  fn spaces_and_control_characters_inside_are_refused() {
    for bad in [
      "java\tscript:alert(1)",
      "java\nscript:alert(1)",
      "java\u{0}script:alert(1)",
      "https://exa mple.org",
    ] {
      let reason = links_problem(&links(&[bad])).expect(bad);
      assert!(reason.contains("control characters"), "{bad:?}: {reason}");
    }
  }

  #[test]
  fn an_overlong_link_is_refused() {
    let long = format!("https://example.org/{}", "a".repeat(MAX_LINK_LENGTH));
    assert!(links_problem(&[long]).unwrap().contains("cannot exceed"));
    let fits = format!("https://example.org/{}", "a".repeat(MAX_LINK_LENGTH - 20));
    assert_eq!(links_problem(&[fits]), None);
  }
}
