# Live League Client verification

Status: **Partly run**, 2026-10-17. A manual items + runes apply to a signed-in client is verified (below); automatic champion-select imports, single-target applies and failure paths are not. Automatic imports remain off by default.

## Manual apply against a signed-in client (2026-10-17)

With the player's consent, the desktop app applied one authored build (Aatrox, "Reference: Contact fighter", items + runes) through **Apply now** with League on the home screen. Personal settings were fingerprinted before and after with `examples/live_snapshot.rs` (SHA-256 over non-managed pages and sets; nothing identifying printed).

| Check | Result |
|---|---|
| First apply (0.1.0 code) | Writes succeeded but read-back reported **partial / not confirmed**. Cause: League adds empty `hideIfSummonerSpell`/`showIfSummonerSpell` to every block and `preferredItemSlots`/`startedFrom` to the set, which the exact-match read-back treated as a difference. The app correctly did not claim success. |
| Fix | Read-back now compares what the player sees (title, champion, maps, mode, block types, item ids and counts); regression test uses the captured shape. Request bodies are now ASCII-escaped JSON like the Python companion (defensive; League stored UTF-8 titles correctly). An apparent title-encoding problem during diagnosis was the test harness reading UTF-8 as cp1252, not League. |
| Second apply (fixed code) | **"Applied and confirmed in League"** — read-back verified items and runes |
| Personal rune pages | 2 before and after; fingerprint `10562f879dd00ce0` unchanged after both applies |
| Personal item sets | 8 before and after; fingerprint `abe8ab5b18ba3672` unchanged after both applies |
| Managed objects | Exactly one Rift Build Lab rune page (9 perks) and one Aatrox item set (4 purchase blocks); the second apply replaced them instead of duplicating |
| Current rune page | The managed page becomes the current page (as the companion does) |
| Backups | One format-1 backup per apply under `%LOCALAPPDATA%/RiftBuildLab/backups` (8→9 sets, 2→3 pages recorded); no credentials in either file |

Published 0.1.0 still contains the strict read-back, so its Apply now reports a successful write as partial; the fix ships in the next release.

## Read-only check against a signed-in client (2026-10-17)

Run with `cargo run -p rbl-core --example live_probe` (GET requests from the typed allowlist only; prints counts and yes/no answers, never credentials, account identifiers, URLs or page names):

| Step | Result |
|---|---|
| Lockfile discovery (running `LeagueClientUx.exe`, ToolHelp32) | Passed |
| TLS with the bundled Riot root (rustls/webpki; only the host-name mismatch waived) | **Passed** — the real local certificate chain is accepted |
| Game version | `16.20.8248524+branch.releases-16-20…`; parses to 16.20 and matches the bundled data (16.20.1) |
| Gameflow phase | `Matchmaking`, then `ReadyCheck` → `InProgress` |
| Signed-in summoner | Present |
| Rune pages | 2 editable, 0 managed; every field the writer reads/writes is present |
| Item sets | 8 sets, 0 managed; `uid` present on every set |

`cargo run -p rbl-core --example live_champ_select -- 240` observed `ReadyCheck` → `InProgress` directly: that queue had no champion select, so the session shape (and the provisional fixtures in `tests/fixtures/champ-select`) is still unconfirmed. Run the observer again during a draft or blind pick; it prints key names and what the reducer derives, nothing identifying.

Use a signed-in client and an account whose existing pages/item sets can be checked. Keep the pre-write backups from `%LOCALAPPDATA%/RiftBuildLab/backups`. Record application version, game/client patch, mode, timestamp, outcome and sanitized observations; never include lockfile passwords or authenticated URLs.

| Check | Status | Expected evidence |
|---|---|---|
| Discover client and Test connection | **Passed (read-only)** | Discovery, Riot-root TLS, version 16.20 and signed-in state confirmed; disconnect display not yet observed |
| Manual items only | Not run | Read-back verified; champion-specific managed set, purchase blocks |
| Manual runes only | Not run | One editable Rift Build Lab page with exact perks/shards |
| Manual items and runes | **Passed** (after the read-back fix) | Both verified; unrelated sets and personal pages unchanged |
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
