//! Exact decimals: the spelling every quantity in the DNA is held to.
//!
//! Moved from `exchanges_integrity` (#475) so a listing's hours and amount (#380)
//! are checked by the same rules as an agreement's terms.

use serde::{Deserialize, Serialize};

/// An amount of something, in a unit.
///
/// `value` is a decimal string, never a binary float, so "0.1" plus "0.2" is
/// exactly "0.3" and a currency amount cannot drift. The accepted spelling is
/// fixed by `decimal_problem`: ASCII digits and at most one dot, up to
/// `MAX_INTEGER_DIGITS` before it and `MAX_FRACTION_DIGITS` after, no sign, no
/// exponent, no leading zero except "0.x". Trailing zeros are kept as written
/// ("12.50"), so two spellings of one amount exist and must be compared with
/// `same_amount`, never with `==` on the string.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Quantity {
  pub value: String,
  pub unit: String,
}

/// Nine integer digits and six fraction digits are fifteen significant digits
/// at most, which an f64 holds exactly enough to survive the one conversion at
/// the hREA boundary (hREA stores `has_numerical_value` as f64, h-REA/hREA#382).
pub const MAX_INTEGER_DIGITS: usize = 9;
pub const MAX_FRACTION_DIGITS: usize = 6;

/// What is wrong with an amount's spelling, if anything.
pub fn decimal_problem(value: &str) -> Option<&'static str> {
  const MALFORMED: &str = "a quantity is a plain decimal like 12.50: digits and at most one dot, no sign, no exponent, no leading zeros, up to 9 digits before the dot and 6 after";
  let (int, frac) = match value.split_once('.') {
    Some((i, f)) => (i, Some(f)),
    None => (value, None),
  };
  let digits = |s: &str| s.bytes().all(|b| b.is_ascii_digit());
  if int.is_empty() || int.len() > MAX_INTEGER_DIGITS || !digits(int) {
    return Some(MALFORMED);
  }
  if int.len() > 1 && int.starts_with('0') {
    return Some(MALFORMED);
  }
  if let Some(f) = frac {
    if f.is_empty() || f.len() > MAX_FRACTION_DIGITS || !digits(f) {
      return Some(MALFORMED);
    }
  }
  None
}

/// True when a well-formed amount is above zero.
pub fn is_positive(value: &str) -> bool {
  value.bytes().any(|b| b.is_ascii_digit() && b != b'0')
}

/// The amount with its trailing fraction zeros dropped: "1.50" and "1.5" both
/// become "1.5", "10.0" becomes "10". Only meaningful for a well-formed value.
fn amount_key(value: &str) -> &str {
  if value.contains('.') {
    value.trim_end_matches('0').trim_end_matches('.')
  } else {
    value
  }
}

/// Two well-formed amounts are equal as numbers, whatever their trailing zeros.
pub fn same_amount(a: &str, b: &str) -> bool {
  amount_key(a) == amount_key(b)
}

#[cfg(test)]
mod decimal_tests {
  use super::*;

  #[test]
  fn canonical_decimals_are_accepted() {
    for ok in [
      "1",
      "12",
      "0.5",
      "0.05",
      "1.5",
      "12.50",
      "999999999",
      "999999999.999999",
      "100",
      "10.0",
    ] {
      assert_eq!(decimal_problem(ok), None, "{ok} should be accepted");
    }
  }

  #[test]
  fn malformed_decimals_are_refused() {
    for bad in [
      "",
      " ",
      "1 ",
      " 1",
      "-1",
      "+1",
      "1e3",
      "1E3",
      "NaN",
      "inf",
      "Infinity",
      ".5",
      "5.",
      ".",
      "1.2.3",
      "1,5",
      "01",
      "00",
      "00.5",
      "0x10",
      "1_000",
      "١٢",
      "1.5\n",
      "9999999999",
      "1.1234567",
      "12345678901234567890",
    ] {
      assert!(decimal_problem(bad).is_some(), "{bad:?} should be refused");
    }
  }

  #[test]
  fn zero_is_well_formed_but_not_positive() {
    for zero in ["0", "0.0", "0.000000"] {
      assert_eq!(decimal_problem(zero), None);
      assert!(!is_positive(zero), "{zero} is not positive");
    }
    for pos in ["0.000001", "1", "10.0"] {
      assert!(is_positive(pos), "{pos} is positive");
    }
  }

  #[test]
  fn amounts_compare_by_value_not_spelling() {
    assert!(same_amount("1.5", "1.50"));
    assert!(same_amount("10", "10.000"));
    assert!(same_amount("0", "0.0"));
    assert!(!same_amount("1.5", "1.51"));
    assert!(!same_amount("10", "1.0"));
    assert!(!same_amount("100", "10"));
  }
}
