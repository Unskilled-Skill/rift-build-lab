# Rift Build Lab desktop and shared build experience

Date: 2026-10-17
Status: Proposed specification for user review; implementation has not started.

## Outcome and approved direction

Provide two independently usable products: the existing GitHub Pages website and an installable Windows desktop application. Both present the same champion builds, visual rune pages, purchase recommendations and damage comparisons. Desktop adds automatic League Client imports, champion-select detection and optional background operation. Long-term maintainability, low CPU use, small distribution size and measured memory use take priority over decorative features.

The user approved a full desktop application, retaining and updating the separate website, and asked whether Rust would be preferable. The chosen design uses Tauri 2 with a native Rust core and the existing React/TypeScript interface. This document makes that direction concrete for review before implementation planning.

## Architecture decision

Use Tauri 2 and the installed Windows WebView2 runtime. Do not bundle Chromium, Node, Python or the existing Python companion as a runtime dependency. The Rust core replaces the desktop integration function of the companion; its validation, backup and rollback contracts remain reference requirements. Existing companion downloads remain available during migration and are not silently installed or removed.

Alternatives considered:

- Electron: straightforward reuse of the UI, but bundling a browser and runtime conflicts with the distribution-footprint priority.
- A complete Rust-native UI: possible, but would duplicate the browser interface and make ongoing feature parity harder. Rust is used where native integration and background work benefit from it.
- Python companion sidecar: quickest reuse of current integration, but adds a second runtime/process and two sets of desktop lifecycle concerns.

Initial supported desktop platform: Windows 10/11 x64. The website retains current browser/mobile support. Other desktop platforms are outside the first release; Windows integration is isolated so they are not prevented later.

## Shared UI and platform boundary

Keep a single source of truth for build cards, rune editing, purchase stages and calculations. Introduce a small platform adapter exposing capabilities, connection status, preferences and explicit apply operations. Browser capabilities never imply native access; desktop IPC commands validate their own input independently.

The production desktop window loads bundled local frontend assets, not the remote website with native privileges. External links open in the user's browser through an allowlisted action. The website remains an ordinary static Pages application and does not require a desktop installation or a running local server. Desktop integration code is loaded only by the desktop target and is absent from the website runtime path.

Use the existing charcoal, sage and ivory visual system, native window controls and keyboard navigation. Preserve the current formula limitations and source evidence labels. No broad redesign of unrelated champion-kit or test-record screens.

## Build screen and purchase order

Every supported build presentation must expose:

1. Champion, role, build name, category, patch, source/check date and a short explanation.
2. Six final item icons and names, full primary/secondary rune choices, three shard selections and expandable effect descriptions.
3. A purchase timeline: starting purchase, early recall alternatives, first core, boots window, later core, and situational alternatives where the available evidence supports those stages.
4. A clear distinction between source-observed purchases, authored priorities, inferred practical suggestions and calculator-derived damage ordering.
5. Load into test bench and export controls on both products; desktop adds Apply now and Set as automatic default for this champion/role.

Use one normalized BuildPlan presentation contract for authored builds, ability-ceiling experiments and generated full meta plans. It includes stable identity, champion, role or explicit unspecified role, patch/data revision, final items, rune page, shards, structured purchase stages and provenance. Each stage separates simultaneous item purchases from choose-one alternatives. Existing authored buyOrder prose remains visible; conversion to item IDs must not silently guess IDs from ambiguous text.

Every build has at least its known ordered final inventory and authored priorities. More detailed starting/recall stages are marked unavailable when they cannot be responsibly derived. Meta plans reuse the existing reviewed purchase-checkpoint rules. Damage planning remains an optional objective-specific view: it does not silently replace practical role ordering, and component stats and omitted procs remain disclosed.

League shop exports contain the selected build's practical stages and final inventory. Earned transformations export buyable prerequisites. Alternatives are separate choose-one blocks. Recommended purchase order is guidance; the application does not buy items or operate the in-game shop.

## First-run and connection UI

First launch opens the full build browser with automatic imports off. A compact desktop connection strip shows League closed, connecting, connected, champion selection, import complete, paused or needs attention. Never label a requested protocol handoff or queued write as successfully applied.

Setup explains what items and runes will change, offers independent item/rune toggles, and enables automatic imports only when the user turns them on. Starting with Windows is a separate opt-in. A test connection action identifies client reachability and version without changing settings. League credentials are discovered locally; there is no Riot-password field, cloud login or API-key requirement for client configuration.

A persistent Import settings view shows chosen defaults, fallback behavior, last applied build, last failure, Pause, Reapply and Open backup folder. No requirement to keep an external browser preview open.

## Automatic selection and application

Store a preferred build per champion and role. If no preference exists, the first-run auto-import setting offers a clearly described current-meta fallback, enabled only as part of the user's explicit auto-import selection. Never choose an unusual experiment automatically merely because it is first in a list. Use a qualified role-specific meta plan; if no suitable role is known or supported, wait and show Choose build rather than guessing.

The Rust monitor owns a serialized state machine:

- Disabled: no League discovery polling.
- Waiting for League: discover a local client with bounded backoff.
- Connected outside champion select: monitor gameflow without writing settings automatically.
- Champion select: read only the local player's selected champion and assigned role. Wait for a stable nonzero selection and a compatible plan.
- Ready to apply: re-read phase, account, local selection and patch immediately before native writes. Abort if any changed.
- Applied: record the session/selection/build-revision identity and apply at most once for that identity.
- Paused/needs attention: stop writes and expose an actionable reason. No blind retry of uncertain mutations.

A champion swap, role change or explicit build selection can create a new eligible identity. Repeated events and duplicate launches cannot cause duplicate item sets or write loops. Returning to a previously applied champion in the same selection session must respect manual changes unless the user explicitly requests Reapply. Switching account invalidates pending operations. Reconnect, game start, unknown phases and patch mismatch block imports.

Manual rune/item changes after an application are respected. An ordinary provider-data refresh does not replace runes in an active champion-select session; a new revision is used for the next selection or an explicit Apply now. Both manual and automatic operations use the same validated writer and a single write queue.

## Native League boundary and ownership

Port the reviewed Python companion behavior to focused Rust modules: discovery, transport, bundle validation, readiness checks, managed configuration, backup/recovery and auto-import state. Keep credentials in memory and out of IPC responses, logs and backups. Verify the local Riot certificate chain without a general insecure TLS fallback. Requests target only the discovered loopback client; payloads cannot select an arbitrary URL, executable or file path.

Manage one deterministic item set per champion and one editable rune page named Rift Build Lab. The app updates the selected build's managed set and reuses its rune page instead of creating hundreds of pages. Preserve unrelated item sets and rune pages. Refuse ambiguous ownership or insufficient rune capacity; never delete a personal page to make space.

Back up the relevant original settings atomically before writes. Preserve current rollback behavior and report partial/uncertain application explicitly. After a successful write, read back the managed configuration and check expected item/rune identities before reporting success. Keep read-back failure distinct from confirmed success; do not retry uncertain page creation automatically.

A custom-scheme website handoff may open a build in the desktop app, but importing external data requires validation and review. It cannot enable automatic imports or bypass the selected-champion checks. Keep the legacy companion's existing scheme ownership intact; any new desktop scheme must use a distinct name unless the user explicitly elects a migration.

## Data consistency and updates

Generate a versioned desktop data manifest from the same validated publication used for the website. It identifies schema version, formula compatibility, data revision, patch, source check dates, file sizes and content hashes. Paths are relative and confined to the known published data tree; no arbitrary external fetch addresses are accepted.

Bundle a minimal usable snapshot and load champion-specific records lazily. Desktop checks the fixed HTTPS publication endpoint on launch, at most once per six hours, and on an explicit Check data updates action. Do not run OP.GG/Lolalytics collectors or ship their Python dependencies on the user's computer. The existing scheduled GitHub publication remains responsible for collection.

Download into staging, validate schema/legal builds/checksums and atomically switch to a complete revision. Retain one last-known-good revision; never mix catalog, plans and provider files from different revisions. Use conditional requests or revision comparisons to avoid unchanged downloads. Failures retain the installed data with its real date. Offline browsing, preferences and calculation continue from cache.

Distinguish data updates from application updates. New provider observations and compatible authored builds do not need a new desktop binary. New formulas, schema changes and incompatible game patches do; block incompatible automatic imports and show that an application update is required. Do not imply that fetching the newest item list automatically updates compiled damage formulas.

Desktop program updates initially use a version check plus an official GitHub Release download link. Do not implement unsigned silent executable replacement. A signed Tauri updater may be added when release signing is configured; it is not necessary for the initial desktop release.

Website and desktop local histories remain separate device stores. Existing scenario/build exports allow explicit transfer; do not promise cloud synchronization. Desktop storage contains defaults and preferences independently of WebView localStorage so background operation survives window destruction.

## Footprint and lifecycle

Use one native process plus the system WebView2 processes while the window is open. No always-on local HTTP server, Python daemon, Node runtime, overlay, screen capture or memory scanning. The Rust monitor uses async I/O with bounded response sizes, timeouts and cancellation.

Prefer one League event subscription while connected, with reconnection backoff. If the client event contract is unavailable, use bounded phase-aware polling: approximately 1 second during champion select, 5 seconds in a connected lobby and 15–60 seconds when no client is available. Hidden UI performs no provider-fetch loops, calculation searches, animations or champion preload. Caching and disk writes occur on actual changes.

When the user chooses tray/background mode and closes the window, persist UI state and destroy the webview; the Rust monitor and tray remain. Reopening reconstructs the window from saved state. Quitting from the tray exits the process and stops imports. Normal close exits when background mode is disabled. No OS service and no automatic startup registration without the separate opt-in.

Performance acceptance targets, to be measured on this machine in a release build (not guaranteed framework properties):

- Background mode with the webview destroyed: average CPU below 0.5% over a 60-second idle interval, and native working set below 80 MiB.
- No repeated full-catalog parsing, network refresh or disk writes during that idle interval.
- Interactive build browser: target combined app/WebView working set below 250 MiB after idle; report native and WebView processes separately and document shared-runtime measurement limits.
- Installer target below 30 MiB excluding a separately required WebView2 runtime; exclude raw source exports and historic provider snapshots from the bundle.
- Cached first-window launch target below 3 seconds on the development machine; release measurements include machine/runtime versions and cold/warm distinction.

Investigate regressions rather than asserting these targets passed from framework choice alone. Use the WebView2 bootstrapper only if the runtime is absent; do not bundle its fixed runtime for the standard installer.

## Verification and release

Meaningful unit/contract tests cover normalized build plans, full-roster legal runes and purchase exports, native validation, fake-client boundary requests, session transitions, account/champion changes, duplicate events, capacity limits, rollback and read-back verification. Reuse existing companion fixtures to check Rust behavior parity rather than trusting a line-for-line port.

Exercise offline startup, interrupted data downloads, corrupt manifests, incompatible patches, duplicate launches, manual overrides, background close/reopen, pause/resume and exit cancellation. Run the existing JavaScript/Python suites and production website build; add Rust tests, release desktop build and Windows packaging. Verify no desktop privileges or native dependencies leak into the published website.

Inspect representative meta, experimental and ceiling builds on desktop and the mobile website. Check purchase alternatives and rune descriptions, keyboard focus, loading/empty/error states and import-state truthfulness. Measure performance before claiming low-footprint targets.

Publish the website through the existing Pages workflow and desktop installers/checksums through a separate Windows release workflow. Keep the website working when desktop packaging fails. Make downloads and platform requirements clear, with the web-only option always available. Preserve existing user settings during updates and uninstall; offer explicit export/recovery rather than silently deleting history.

A signed-in real League Client test is required before describing live automatic imports as verified. Mock transport tests and successful packaging do not establish that. Public releases retain the applicable Riot registration/disclosure requirement and unsupported-client-interface status.

## Scope boundary

First release includes the full desktop build browser, shared build/rune/purchase presentation, preferred builds, direct apply, automatic champion-select imports, tray operation, compatible data updates, installer/release workflow and preservation of the separate website. It excludes gameplay automation, auto-buying, queue acceptance, overlays, cloud accounts, live AI services and performance claims unsupported by measurement.

## Primary references

- Tauri WebView providers: https://v2.tauri.app/reference/webview-versions/
- Tauri Windows installers and WebView2 installation modes: https://v2.tauri.app/distribute/windows-installer/
- Tauri capabilities: https://v2.tauri.app/security/capabilities/
- Riot League Client API status and disclosure: https://developer.riotgames.com/docs/lol#league-client-api
- Mobalytics automatic import workflow inspiration: https://mobalytics.gg/blog/lol-how-to-use-mobalytics-overlay-live-companion/
- Porofessor build/rune import workflow inspiration: https://porofessor.gg/en/download
