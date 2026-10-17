use crate::CoreError;
/// An OS registration is only successful when it can be read back as requested.
pub fn sync_startup(
    wanted: bool,
    read: impl Fn() -> Result<bool, CoreError>,
    change: impl Fn(bool) -> Result<(), CoreError>,
) -> Result<(), CoreError> {
    if read()? != wanted {
        change(wanted)?;
    }
    if read()? != wanted {
        return Err(CoreError::Internal);
    }
    Ok(())
}
