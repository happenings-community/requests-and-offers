#[cfg(test)]
mod status_tests {
  use chrono::Duration;
  use hdi::prelude::Timestamp;

  use crate::status::*;

  #[test]
  fn test_create_basic_status() {
    let mut status = Status::pending();
    assert_eq!(status.status_type, "pending");

    status = Status::accept();
    assert_eq!(status.status_type, "accepted");

    status = Status::reject();
    assert_eq!(status.status_type, "rejected");
  }

  #[test]
  fn test_create_and_unsuspend_suspended_status() {
    let mut status = Status::pending();
    assert_eq!(status.status_type, "pending");
    assert_eq!(status.reason, None);
    assert_eq!(status.suspended_until, None);

    status = Status::accept();
    assert_eq!(status.status_type, "accepted");
    assert_eq!(status.reason, None);
    assert_eq!(status.suspended_until, None);

    status = Status::suspend("test", None);
    assert_eq!(status.status_type, "suspended indefinitely");
    assert_eq!(status.reason, Some("test".to_string()));
    assert_eq!(status.suspended_until, None);

    status.unsuspend();
    assert_eq!(status.status_type, "accepted");
    assert_eq!(status.reason, None);
    assert_eq!(status.suspended_until, None);

    let now = Timestamp::from_micros(chrono::UTC::now().timestamp_subsec_micros() as i64);
    status = Status::suspend("test", Some((Duration::days(7), &now)));
    assert_eq!(status.status_type, "suspended temporarily");
    assert_eq!(status.reason, Some("test".to_string()));

    let remaining_time = status.get_suspension_time_remaining(&now);
    let remaining_days = remaining_time.unwrap().num_days();
    assert_eq!(remaining_days, 7);

    status.unsuspend();
    assert_eq!(status.status_type, "accepted");
    assert_eq!(status.reason, None);
    assert_eq!(status.suspended_until, None);
  }

  /// Fixed times, so the result never depends on when the test runs.
  fn hours(n: i64) -> Timestamp {
    Timestamp::from_micros(Duration::hours(n).num_microseconds().unwrap_or(0))
  }

  #[test]
  fn test_unsuspend_if_time_passed() {
    // A one-hour suspension that started two hours ago ended an hour ago.
    let mut status = Status::suspend("test", Some((Duration::hours(1), &hours(8))));
    assert!(status.unsuspend_if_time_passed(&hours(10)));
    assert_eq!(status.status_type, "accepted");
  }

  #[test]
  fn test_unsuspend_when_time_runs_out_exactly() {
    let mut status = Status::suspend("test", Some((Duration::hours(1), &hours(9))));
    assert!(status.unsuspend_if_time_passed(&hours(10)));
    assert_eq!(status.status_type, "accepted");
  }

  #[test]
  fn test_suspension_with_time_left_stays() {
    // Thirty minutes of a one-hour suspension remain: it must not be lifted early.
    let started = Timestamp::from_micros(
      hours(10).as_micros() - Duration::minutes(30).num_microseconds().unwrap_or(0),
    );
    let mut status = Status::suspend("test", Some((Duration::hours(1), &started)));
    assert!(!status.unsuspend_if_time_passed(&hours(10)));
    assert_eq!(status.status_type, "suspended temporarily");
  }
}
