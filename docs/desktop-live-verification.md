# Live League Client verification

Status: **Blocked — not run**, 2026-10-17. No LeagueClient/LeagueClientUx process was running during this continuation. The installer and automated tests do not establish compatibility with a signed-in client. Automatic imports remain off by default. Do not publish this preview as live-client verified.

Use a signed-in client and an account whose existing pages/item sets can be checked. Keep the pre-write backups from `%LOCALAPPDATA%/RiftBuildLab/backups`. Record application version, game/client patch, mode, timestamp, outcome and sanitized observations; never include lockfile passwords or authenticated URLs.

| Check | Status | Expected evidence |
|---|---|---|
| Discover client and Test connection | Not run | Correct connection/patch; disconnect shown clearly |
| Manual items only | Not run | Read-back verified; champion-specific managed set, purchase blocks |
| Manual runes only | Not run | One editable Rift Build Lab page with exact perks/shards |
| Manual items and runes | Not run | Both verified; unrelated sets and personal pages unchanged |
| Full rune capacity | Not run | Explicit failure; no personal page deleted |
| Preferred build in draft / blind / ARAM | Not run | Correct locked champion, known role/default; once per selection |
| Champion trade/swap or role change | Not run | Stale queued writes aborted; current local selection used |
| Account change | Not run | No write to old account; correct status and safe retry policy |
| Reconnect and refreshed provider data | Not run | No repeated overwrite of a previously attempted selection |
| Manual edits after auto import | Not run | Remain unchanged until explicit Reapply |
| Game starts during queued apply | Not run | Unsafe write blocked |
| Explicit Reapply after manual repair | Not run | Deliberate reapplication and accurate read-back status |
| Offline client and malformed lockfile | Not run | Bounded discovery, useful error, no credential disclosure |
| Uncertain response or rollback | Not run | No blind retry; truthful partial/unverified result; usable backup |

These cases have fixture/regression coverage where practical. If the live client differs, capture a sanitized fixture and add a failing regression before changing behavior. In particular, keep certificate chain validation: the transport permits the known hostname mismatch only, not arbitrary invalid certificates.

# Installer lifecycle gate

Also not run: fresh installation through the NSIS UI, upgrade preserving preferences/backups, uninstall preserving user data, registered desktop links from the website, and tray close/reopen with real edited drafts. Direct release-executable startup is measured separately; it does not satisfy these checks. Native UI automation is unavailable in this session, so first-run/settings interaction has not received an end-to-end native UI check.
