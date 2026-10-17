//! League Client lockfile credentials. The password stays in memory only and is never
//! formatted, serialized or included in an error.

use std::fmt;

use crate::CoreError;

/// Local client password; `Debug` is redacted and the buffer is cleared on drop.
pub struct Secret(String);

impl Secret {
    #[allow(dead_code, reason = "read only by the LCU transport (plan T9)")]
    pub(crate) fn expose(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for Secret {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("<redacted>")
    }
}

impl Drop for Secret {
    fn drop(&mut self) {
        // SAFETY: zero bytes are valid UTF-8, so the String stays well-formed until it is freed.
        unsafe { self.0.as_bytes_mut().fill(0) }
    }
}

#[derive(Debug)]
pub struct Credentials {
    port: u16,
    #[allow(dead_code, reason = "read only by the LCU transport (plan T9)")]
    password: Secret,
}

impl Credentials {
    pub fn port(&self) -> u16 {
        self.port
    }
    #[allow(dead_code, reason = "read only by the LCU transport (plan T9)")]
    pub(crate) fn password(&self) -> &str {
        self.password.expose()
    }
}

fn ascii_number(text: &str) -> Option<u64> {
    if text.is_empty() || text.len() > 10 || !text.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    text.parse().ok()
}

/// Parses `name:pid:port:password:protocol` exactly as the companion does.
pub fn parse_lockfile(text: &str) -> Result<Credentials, CoreError> {
    let fields: Vec<&str> = text.trim().split(':').collect();
    let [name, pid, port, password, protocol] = fields[..] else { return Err(CoreError::ClientUnavailable) };
    let valid_password =
        (1..=256).contains(&password.len()) && password.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-');
    match (ascii_number(pid), ascii_number(port)) {
        (Some(pid), Some(port))
            if matches!(name, "LeagueClient" | "LeagueClientUx")
                && pid > 0
                && (1..=65535).contains(&port)
                && protocol == "https"
                && valid_password =>
        {
            Ok(Credentials { port: port as u16, password: Secret(password.to_owned()) })
        }
        _ => Err(CoreError::ClientUnavailable),
    }
}
