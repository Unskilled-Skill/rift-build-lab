use rbl_core::{CoreError, startup::sync_startup};
#[test]
fn registration_errors_are_returned_and_success_is_read_back() {
    assert!(sync_startup(true, || Ok(false), |_| Err(CoreError::Internal)).is_err());
    assert!(sync_startup(false, || Err(CoreError::Internal), |_| Ok(())).is_err());
    assert!(sync_startup(true, || Ok(false), |_| Ok(())).is_err());
    let value = std::cell::Cell::new(false);
    assert!(
        sync_startup(
            true,
            || Ok(value.get()),
            |wanted| {
                value.set(wanted);
                Ok(())
            }
        )
        .is_ok()
    );
    assert!(value.get());
}
