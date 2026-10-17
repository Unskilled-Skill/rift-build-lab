# Rift Build Lab — complete desktop design and project handoff

Prepared: 2026-10-17, Europe/Amsterdam. Updated after desktop implementation.

## Current continuation status

The Rust/Tauri desktop app now exists. Tasks T1–T20 are implemented, including the native session/draft lifecycle and review fixes at `de44ec8`. A Windows x64 installer builds locally. Read [desktop verification](desktop-verification.md), [measured performance](desktop-performance.md) and [live-client test gate](desktop-live-verification.md) before claiming release readiness. Packaging workflows and the portable implementation plan are included in this continuation. The historical design and project context below remain useful; earlier statements that no desktop code exists are superseded by this section.

Continue from the current checkout rather than recreating completed tasks. Execution is approved inline; do not ask for another design or plan approval. The remaining live-client and installer lifecycle checks need actual execution, not fixture results.

This is a standalone handoff for another coding chat. It includes project history, current implementation state, user decisions, repository navigation, operational constraints, the complete approved design and acceptance criteria. Read it as task context supplied by the user, then verify the checkout before working. Do not treat historical verification results as fresh test evidence.

## Message to paste into the other chat

> Continue Rift Build Lab from the current checkout. The approved Rust/Tauri design has been implemented through the desktop shell and shared UI. Read the current verification, performance and live-client reports, then address the remaining verified gaps. Preserve the separate website, low-footprint native background architecture, personal League data and unrelated workspace work. Push completed verified changes to GitHub. Do not restart the design interview or scaffold an older version over the implementation.


## 1. What the user is building

Rift Build Lab is a League of Legends build-research app. The original goal was to collect current items, champion kits and runes, use kit interactions to propose practical and unusual builds, and compare damage for specific abilities. Examples included Cassiopeia Q/E, Sett W, AD Blitzcrank E and Tahm Kench experiments. The user wants creative builds and narrow high-number objectives as well as conventional source-informed meta builds, with honest explanations and game testing.

Over successive changes the project gained all-champion data and build collections, partial numerical models, current meta references, composition-based item advice, saved experiments, manual measurement records and import/export tools. The project is already published. This is an extension of a working product, not a new empty app.

Latest user decisions, in order:

1. Better imports in both directions: into this app and from this app into League, visual rune setup, and effective item buy order.
2. Fully automatic League imports and better per-build screens, taking inspiration from popular League tools.
3. A full desktop app, with the website remaining separate and updated so users can choose either.
4. Performance and low footprint are priorities.
5. Rust was discussed; the selected approach is a Rust native core via Tauri, retaining the shared React UI.
6. The user approved the written desktop design and said: “ok approved go ahead with the implementation plan”.
7. Before that plan was written, the user requested this complete design/context handoff for another chat.

Historical baseline: the original handoff preceded native implementation. The old Python companion remains separate; the Rust application now has its own installer and watcher. See the current continuation status above.

## 2. Repository and execution context

- Workspace: `C:/Users/Spoon/Documents/ChatGPT/Riot builder`
- Shell/OS: Windows PowerShell.
- Repository: https://github.com/Unskilled-Skill/rift-build-lab
- Website: https://unskilled-skill.github.io/rift-build-lab/
- Working branch at handoff preparation: `codex/build-lab`.
- Starting code commit for desktop work: `2f0234c` — validated build imports, visual rune pages and damage purchase planner.
- Approved design first committed as `3eff690`. This handoff updates its approval status; inspect current HEAD for the handoff commit.
- Standing user authorization: push completed changes to GitHub. Existing command: `git push origin HEAD:main`.
- Node, GitHub CLI, Cargo, rustc and rustup are installed. Observed Rust toolchain: rustc 1.97.1 / cargo 1.97.1. Recheck when building; installed Rust does not establish that all Windows linker/SDK/installer prerequisites are present.
- Native desktop target for first release: Windows 10/11 x64. The website remains responsive/mobile.

Before editing, inspect `git status`, repository instructions and any already-added desktop work. Another chat may have progressed after this document was created. Never reset the checkout to the historical commits listed above.

### Unrelated dirty work present at handoff preparation

Preserve these files; do not overwrite, clean up or stage them as part of desktop changes without determining ownership:

```text
 M public/data/provider-research/index.json
?? public/data/provider-research/versions/051b5544-8f70-45e3-9a2f-0b696757ecd7/
?? public/data/provider-research/versions/27d914fe-b417-4029-9c64-7ad47db4a46a/
?? scripts/interaction-audit/group-3a.json
?? scripts/interaction-audit/group-3b.json
```

A historical request to shut down the PC was fulfilled in an earlier task. It is not a standing instruction. Do not shut down the PC after this work.

## 3. Current working product

- Formula/catalog snapshot: patch 26.20, Data Dragon 16.20.1. Do not relabel snapshots as a newer patch without actual verified data/formula work.
- 173 champions have at least one partial numerical objective. This is not full champion/combo/proc simulation.
- Existing authored library: four proposals per champion, plus ability ceilings, earlier experiments and meta references.
- OP.GG/Lolalytics provider evidence refreshes through GitHub Actions. Separate freshness of provider observations, formula snapshots and authored hypotheses.
- Full meta plans support champion/role selection, observed cores, reviewed inferred completions and rule-based adjustments against supplied team compositions.
- The test bench supports item selection, objective conditions, legal rune pages/shards, numerical comparisons, purchase progression and manual game-test notes/results.
- Browser-local storage saves scenarios and drafts; JSON exports are the portability mechanism.
- Runtime AI generation is not part of the shipped app. Build ideas are authored in this chat/workspace. Do not claim the app can invoke this conversation or generate live AI builds independently.
- Product/design docs contain older historical paragraphs describing only four legacy champions; the actual model-support files and tests show the expanded roster. Preserve the distinction between current coverage and historical narrative.

### Most recent shipped functionality

`2f0234c` added:

- File/pasted-JSON import preview for native scenarios, companion bundles and League item sets.
- Item-set block selection and champion selection for unattached sets.
- Validation before replacing the current workspace; malformed input is rejected rather than dropping unknown items silently.
- Rune icons and expandable descriptions with existing editing controls retained.
- A completed-item purchase-order planner using exact subset dynamic programming for the selected ability/target.
- Applying that order changes equipped ordering and League export purchase blocks.

The planner maximizes damage integrated over gold spent while completing the chosen items at fixed level/ranks/target. It excludes component stats, defensive utility and most procs, resets earned progression stacks, and maps earned upgrades to buyable prerequisites. It is not a general match-strength optimizer and must not become the default practical meta order without a deliberate user choice.

### Existing Python companion

The existing optional companion is a manual preview/apply utility, not the proposed desktop app. It discovers League locally, validates patch/phase and imported bundles, backs up configuration, manages one item set per champion and one rune page, preserves personal pages and attempts rollback on failures. It has a local HTTP preview with a session token and a `riftbuildlab://` handoff.

The planned Rust application should preserve and test those integration guarantees without shipping Python as a runtime dependency. The old companion's live client apply remains unverified. Do not mark real automatic integration verified just because mock-client tests pass.

## 4. Code map for the next chat

### Shared app and UI

- `src/App.tsx`: champion selection, top-level tabs, test bench, draft/save/import integration. Large component; extract only focused units needed by this feature.
- `src/BuildLibrary.tsx`: authored build collections and per-build actions.
- `src/FullMetaPanel.tsx`: source/role meta plan, composition advice and export.
- `src/RunePreview.tsx`: visual selected rune page and effect descriptions.
- `src/BuildImport.tsx`, `src/build-import.ts`: incoming build parsing, validation and preview.
- `src/LeagueImportActions.tsx`, `src/league-export.ts`: outgoing item sets, rune page/bundle creation, protocol handoff and downloads.
- `src/PurchaseGuide.tsx`, `src/purchase-checkpoints.ts`: practical inferred/source-informed meta purchase stages.
- `src/PurchasePlanner.tsx`, `src/purchase-planner.ts`: objective-specific completed-item order optimizer.
- `src/ComparisonLab.tsx`, `src/comparison-lab.ts`: baseline, progression and defense comparisons.
- `src/types.ts`, `src/chat-builds.ts`, `src/meta-recommendations.ts`: current data/build contracts.
- `src/engine.ts`, `src/ability-models.ts`, `src/ability-sources.json`, `src/model-support.ts`: calculations, sources and objective coverage.
- `src/hosting.ts`: current dev-service switch and base-path helper; do not equate Tauri production with Vite dev mode.
- `src/ProviderRefresh.tsx`: local-development provider-refresh controls. Do not accidentally ship collector loops as desktop background work.

### Native reference, data and publication

- `companion/core.py`: validation, client discovery/transport, readiness checks, backups, ownership and rollback reference.
- `companion/app.py`, `companion/app.js`, `companion/index.html`: current local manual-preview lifecycle.
- `companion/launcher.py`: legacy protocol registration/ownership behavior.
- `tests/companion_test.py`, `tests/companion_contract_test.py`, `tests/companion_installer_test.py`: native boundary behavior to preserve.
- `tests/league-export.test.ts`, `tests/build-transfer-planner.test.ts`: frontend export/import and planner contracts.
- `public/data/catalog.json`: compact current catalog.
- `public/data/champion-builds/`, `ability-ceilings/`, `champions/`: champion-specific data.
- `public/data/champion-meta-plans.json`, `meta-baselines.json`: meta plans/references.
- `public/data/provider-research/`, `provider-roles/`: provider observations and versioned references.
- `scripts/prepare-data.mjs`, `scripts/prepare-provider-research.mjs`, `scripts/prepare-champion-builds.mjs`: build/data preparation.
- `.github/workflows/pages.yml`: website test, provider refresh, build and deployment workflow.
- `vite.config.mjs`: Vite base path and local-only service middleware.
- `PRODUCT.md`, `DESIGN.md`: incumbent product and visual system.

### Native interface boundaries to define in the implementation plan

Use focused Rust units for client discovery/transport, bundle validation, managed writes/recovery, auto-import state, preference storage, data revision cache and window/tray lifecycle. A shared TypeScript platform adapter should expose only the app's needed capabilities and typed operations, not unrestricted native HTTP/filesystem access.

An implementation plan should pin exact module names, IPC DTOs, error classes and commands rather than leaving adjacent tasks to invent incompatible contracts. Validate everything at the Rust boundary even if the frontend has already validated it.

## 5. Proposed screen organization within the approved design

Keep the existing dark research-tool identity. The following layout makes the approved UI requirements concrete without claiming it is implemented:

- **Global shell:** champion chooser, shared sections and compact desktop-only connection strip. Website has no false native connection indicator.
- **Build library:** collection and role filters, concise build summaries, final inventory, keystone, cost and source status. Selecting a build opens its detailed view; mobile uses a single-column disclosure/navigation flow.
- **Build detail:** goal and playstyle first; practical purchase stages and complete visual rune page next; alternatives, item/rune rationale, tradeoffs and calculator limits below. Keep the currently selected build obvious.
- **Purchase stages:** numbered steps with item icons/names, cumulative costs where meaningful, and explicit choose-one alternatives. Starting items and situational options are not shown as simultaneous final purchases.
- **Primary actions:** Load into test bench and Export on both platforms. Desktop adds Apply now and Set automatic default. Show champion/role and selected import targets beside the action.
- **Automatic import settings:** enable/pause, independent item/rune switches, preferred builds per champion/role, meta fallback, last result/error and tray/startup preferences.
- **Connection states:** League closed, connecting, connected, champion select, applying, verified applied, paused and needs attention. Errors name the reason and recovery, with partial apply clearly distinct from success.
- **Test bench:** preserve current fixed-condition comparisons and visual runes. Keep damage-derived ordering distinct from practical build ordering.

Use the established tokens: background `#11191c`, panels `#182226`, raised `#202d31`, text `#edf1e9`, secondary `#b3c0bf`, sage `#c0dfab`, warnings `#f1c477`; locally hosted DM Sans, tabular figures and Lucide icons. Focus states, keyboard operation and mobile layout remain requirements. Avoid overlays, animated dashboards, decorative effects and new heavyweight UI packages.

## 6. Verification history and implementation cautions

Last recorded verification of the shipped web/import changes: 813 Vitest tests across 44 files, 33 Python tests and a passing production build. Desktop/mobile checks verified the live import flow, rune icons, planner and no horizontal overflow at 390px. These are historical results, not tests run for a Rust implementation.

Standard existing checks:

```powershell
npm test
npm run build
python -m unittest discover -s tests -p '*test.py'
git diff --check
```

Add Rust tests, release builds, packaging and actual performance measurements for desktop. Verify the public website remains functional independently.

Important CI lesson: raw exports under ignored `data/lol/...` exist locally but are absent in CI. Tests must use tracked compact data or small reviewed fixtures. An earlier deployment failed because a test read a local ignored engine file; it was repaired by using a tracked reviewed source snapshot. Do not repeat that dependency.

The existing production frontend has a roughly 722 KB JavaScript chunk and an existing Vite size warning. Do not hide it by simply increasing the warning threshold. Desktop work should avoid whole-catalog eager loads and heavy extra dependencies; targeted lazy loading is appropriate where it serves the approved design.

Website publication currently performs provider refreshes before deployment and can take several minutes. Keep the website and desktop release jobs independent. Do not disable data validation or remove refresh steps just to shorten deployment.

No signed-in real League test has established native apply correctness. Test against a real client before making that claim; keep blocked live verification visible when the client is unavailable. Prefer the native API boundary over gameplay UI automation.

## 7. Where the next chat should resume

The design below is approved. The detailed implementation plan has not been written and no Tauri scaffolding or product dependencies have been added.

Next deliverable: write the full implementation plan under `docs/superpowers/plans/`, grounded in this spec and a fresh checkout inspection. It should define focused files/interfaces, dependencies between tasks, meaningful failing/passing tests, migration from manual exports, website regression checks, native state-machine tests, release packaging and measured resource checks. Present the plan for the applicable review/execution choice instead of restarting the architecture decision.

A useful sequencing outline is shared BuildPlan/purchase UI, native validated client integration, desktop shell/preferences, automatic selection state machine, atomic data updates, tray lifecycle, then packaging/live-client/performance verification. This outline is not a substitute for the exact task-by-task implementation plan.

The user has already approved Rust/Tauri, keeping React shared with the separate website, automatic imports, low footprint and the full design. Ask only about genuinely missing decisions; do not ask again whether a desktop application is wanted. Follow the user's standing push instruction and preserve unrelated work.

---

## 8. Complete approved specification

The complete approved design follows. It is included here so this handoff can be shared as a single document without needing access to the earlier conversation.

### Rift Build Lab desktop and shared build experience

Date: 2026-10-17
Status: User approved on 2026-10-17. Implementation planning is authorized; desktop implementation has not started.

#### Outcome and approved direction

Provide two independently usable products: the existing GitHub Pages website and an installable Windows desktop application. Both present the same champion builds, visual rune pages, purchase recommendations and damage comparisons. Desktop adds automatic League Client imports, champion-select detection and optional background operation. Long-term maintainability, low CPU use, small distribution size and measured memory use take priority over decorative features.

The user approved a full desktop application, retaining and updating the separate website, and asked whether Rust would be preferable. The chosen design uses Tauri 2 with a native Rust core and the existing React/TypeScript interface. The user subsequently approved this written design and authorized the implementation plan. The next deliverable is that plan; the user also requested a portable full-design/context handoff for another chat.

#### Architecture decision

Use Tauri 2 and the installed Windows WebView2 runtime. Do not bundle Chromium, Node, Python or the existing Python companion as a runtime dependency. The Rust core replaces the desktop integration function of the companion; its validation, backup and rollback contracts remain reference requirements. Existing companion downloads remain available during migration and are not silently installed or removed.

Alternatives considered:

- Electron: straightforward reuse of the UI, but bundling a browser and runtime conflicts with the distribution-footprint priority.
- A complete Rust-native UI: possible, but would duplicate the browser interface and make ongoing feature parity harder. Rust is used where native integration and background work benefit from it.
- Python companion sidecar: quickest reuse of current integration, but adds a second runtime/process and two sets of desktop lifecycle concerns.

Initial supported desktop platform: Windows 10/11 x64. The website retains current browser/mobile support. Other desktop platforms are outside the first release; Windows integration is isolated so they are not prevented later.

#### Shared UI and platform boundary

Keep a single source of truth for build cards, rune editing, purchase stages and calculations. Introduce a small platform adapter exposing capabilities, connection status, preferences and explicit apply operations. Browser capabilities never imply native access; desktop IPC commands validate their own input independently.

The production desktop window loads bundled local frontend assets, not the remote website with native privileges. External links open in the user's browser through an allowlisted action. The website remains an ordinary static Pages application and does not require a desktop installation or a running local server. Desktop integration code is loaded only by the desktop target and is absent from the website runtime path.

Use the existing charcoal, sage and ivory visual system, native window controls and keyboard navigation. Preserve the current formula limitations and source evidence labels. No broad redesign of unrelated champion-kit or test-record screens.

#### Build screen and purchase order

Every supported build presentation must expose:

1. Champion, role, build name, category, patch, source/check date and a short explanation.
2. Six final item icons and names, full primary/secondary rune choices, three shard selections and expandable effect descriptions.
3. A purchase timeline: starting purchase, early recall alternatives, first core, boots window, later core, and situational alternatives where the available evidence supports those stages.
4. A clear distinction between source-observed purchases, authored priorities, inferred practical suggestions and calculator-derived damage ordering.
5. Load into test bench and export controls on both products; desktop adds Apply now and Set as automatic default for this champion/role.

Use one normalized BuildPlan presentation contract for authored builds, ability-ceiling experiments and generated full meta plans. It includes stable identity, champion, role or explicit unspecified role, patch/data revision, final items, rune page, shards, structured purchase stages and provenance. Each stage separates simultaneous item purchases from choose-one alternatives. Existing authored buyOrder prose remains visible; conversion to item IDs must not silently guess IDs from ambiguous text.

Every build has at least its known ordered final inventory and authored priorities. More detailed starting/recall stages are marked unavailable when they cannot be responsibly derived. Meta plans reuse the existing reviewed purchase-checkpoint rules. Damage planning remains an optional objective-specific view: it does not silently replace practical role ordering, and component stats and omitted procs remain disclosed.

League shop exports contain the selected build's practical stages and final inventory. Earned transformations export buyable prerequisites. Alternatives are separate choose-one blocks. Recommended purchase order is guidance; the application does not buy items or operate the in-game shop.

#### First-run and connection UI

First launch opens the full build browser with automatic imports off. A compact desktop connection strip shows League closed, connecting, connected, champion selection, import complete, paused or needs attention. Never label a requested protocol handoff or queued write as successfully applied.

Setup explains what items and runes will change, offers independent item/rune toggles, and enables automatic imports only when the user turns them on. Starting with Windows is a separate opt-in. A test connection action identifies client reachability and version without changing settings. League credentials are discovered locally; there is no Riot-password field, cloud login or API-key requirement for client configuration.

A persistent Import settings view shows chosen defaults, fallback behavior, last applied build, last failure, Pause, Reapply and Open backup folder. No requirement to keep an external browser preview open.

#### Automatic selection and application

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

#### Native League boundary and ownership

Port the reviewed Python companion behavior to focused Rust modules: discovery, transport, bundle validation, readiness checks, managed configuration, backup/recovery and auto-import state. Keep credentials in memory and out of IPC responses, logs and backups. Verify the local Riot certificate chain without a general insecure TLS fallback. Requests target only the discovered loopback client; payloads cannot select an arbitrary URL, executable or file path.

Manage one deterministic item set per champion and one editable rune page named Rift Build Lab. The app updates the selected build's managed set and reuses its rune page instead of creating hundreds of pages. Preserve unrelated item sets and rune pages. Refuse ambiguous ownership or insufficient rune capacity; never delete a personal page to make space.

Back up the relevant original settings atomically before writes. Preserve current rollback behavior and report partial/uncertain application explicitly. After a successful write, read back the managed configuration and check expected item/rune identities before reporting success. Keep read-back failure distinct from confirmed success; do not retry uncertain page creation automatically.

A custom-scheme website handoff may open a build in the desktop app, but importing external data requires validation and review. It cannot enable automatic imports or bypass the selected-champion checks. Keep the legacy companion's existing scheme ownership intact; any new desktop scheme must use a distinct name unless the user explicitly elects a migration.

#### Data consistency and updates

Generate a versioned desktop data manifest from the same validated publication used for the website. It identifies schema version, formula compatibility, data revision, patch, source check dates, file sizes and content hashes. Paths are relative and confined to the known published data tree; no arbitrary external fetch addresses are accepted.

Bundle a minimal usable snapshot and load champion-specific records lazily. Desktop checks the fixed HTTPS publication endpoint on launch, at most once per six hours, and on an explicit Check data updates action. Do not run OP.GG/Lolalytics collectors or ship their Python dependencies on the user's computer. The existing scheduled GitHub publication remains responsible for collection.

Download into staging, validate schema/legal builds/checksums and atomically switch to a complete revision. Retain one last-known-good revision; never mix catalog, plans and provider files from different revisions. Use conditional requests or revision comparisons to avoid unchanged downloads. Failures retain the installed data with its real date. Offline browsing, preferences and calculation continue from cache.

Distinguish data updates from application updates. New provider observations and compatible authored builds do not need a new desktop binary. New formulas, schema changes and incompatible game patches do; block incompatible automatic imports and show that an application update is required. Do not imply that fetching the newest item list automatically updates compiled damage formulas.

Desktop program updates initially use a version check plus an official GitHub Release download link. Do not implement unsigned silent executable replacement. A signed Tauri updater may be added when release signing is configured; it is not necessary for the initial desktop release.

Website and desktop local histories remain separate device stores. Existing scenario/build exports allow explicit transfer; do not promise cloud synchronization. Desktop storage contains defaults and preferences independently of WebView localStorage so background operation survives window destruction.

#### Footprint and lifecycle

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

#### Verification and release

Meaningful unit/contract tests cover normalized build plans, full-roster legal runes and purchase exports, native validation, fake-client boundary requests, session transitions, account/champion changes, duplicate events, capacity limits, rollback and read-back verification. Reuse existing companion fixtures to check Rust behavior parity rather than trusting a line-for-line port.

Exercise offline startup, interrupted data downloads, corrupt manifests, incompatible patches, duplicate launches, manual overrides, background close/reopen, pause/resume and exit cancellation. Run the existing JavaScript/Python suites and production website build; add Rust tests, release desktop build and Windows packaging. Verify no desktop privileges or native dependencies leak into the published website.

Inspect representative meta, experimental and ceiling builds on desktop and the mobile website. Check purchase alternatives and rune descriptions, keyboard focus, loading/empty/error states and import-state truthfulness. Measure performance before claiming low-footprint targets.

Publish the website through the existing Pages workflow and desktop installers/checksums through a separate Windows release workflow. Keep the website working when desktop packaging fails. Make downloads and platform requirements clear, with the web-only option always available. Preserve existing user settings during updates and uninstall; offer explicit export/recovery rather than silently deleting history.

A signed-in real League Client test is required before describing live automatic imports as verified. Mock transport tests and successful packaging do not establish that. Public releases retain the applicable Riot registration/disclosure requirement and unsupported-client-interface status.

#### Scope boundary

First release includes the full desktop build browser, shared build/rune/purchase presentation, preferred builds, direct apply, automatic champion-select imports, tray operation, compatible data updates, installer/release workflow and preservation of the separate website. It excludes gameplay automation, auto-buying, queue acceptance, overlays, cloud accounts, live AI services and performance claims unsupported by measurement.

#### Primary references

- Tauri WebView providers: https://v2.tauri.app/reference/webview-versions/
- Tauri Windows installers and WebView2 installation modes: https://v2.tauri.app/distribute/windows-installer/
- Tauri capabilities: https://v2.tauri.app/security/capabilities/
- Riot League Client API status and disclosure: https://developer.riotgames.com/docs/lol#league-client-api
- Mobalytics automatic import workflow inspiration: https://mobalytics.gg/blog/lol-how-to-use-mobalytics-overlay-live-companion/
- Porofessor build/rune import workflow inspiration: https://porofessor.gg/en/download
