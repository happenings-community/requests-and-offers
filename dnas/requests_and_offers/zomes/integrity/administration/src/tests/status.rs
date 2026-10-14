#[cfg(test)]
mod status_tests {
  use chrono::Duration;
  use hdi::prelude::Timestamp;
  use utils::timetamp_now;

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

  #[test]
  fn test_unsuspend_if_time_passed() {
    let now = timetamp_now();
    let timestamp_1_hours_ago = Timestamp::from_micros(
      timetamp_now().as_micros() - Duration::hours(1).num_microseconds().unwrap_or(0),
    );

    let mut status = Status::suspend("test", Some((Duration::hours(1), &timestamp_1_hours_ago)));
    status.unsuspend_if_time_passed(&now);
    assert_eq!(status.status_type, "accepted");
  }
}
