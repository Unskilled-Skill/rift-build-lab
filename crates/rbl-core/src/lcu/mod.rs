//! League Client (LCU) boundary: credentials, discovery, champ-select reading and transport.

pub mod champ_select;
pub mod discovery;
pub mod lockfile;
pub mod transport;

use std::path::PathBuf;

use crate::CoreError;
use crate::monitor::ClientSource;

/// Production client source: discovers the running client and connects with the bundled Riot root.
#[derive(Debug, Clone, Default)]
pub struct LocalClientSource {
    /// Optional League install folder chosen by the user.
    pub league_dir: Option<PathBuf>,
}

impl ClientSource for LocalClientSource {
    type Client = transport::LcuClient;
    fn connect(&self) -> Result<Self::Client, CoreError> {
        transport::LcuClient::new(discovery::discover(self.league_dir.clone())?)
    }
}
