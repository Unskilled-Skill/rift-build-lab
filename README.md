# Rift Build Lab

Local League of Legends build research app. Patch 26.20 / Data Dragon 16.20.1 snapshot.

```powershell
npm install
npm run data
npm run dev
```

Open the local URL printed by Vite (normally http://127.0.0.1:5173). `npm run build` regenerates the data bundle, checks TypeScript and builds the production app. `npm test` runs independent calculation, constraint and import fixtures.

All 173 champions have kit data, source formula browsers and precomputed AI-authored experimental item cores. The catalog contains all 870 item records and 69 runes/shards; source flags do not establish live availability. The compact browser snapshot is checked in, so the app also works without the separate full raw exports.

Numerical adapters cover Cassiopeia Q/E and Sett W. Search ranks a limited model over a small curated candidate pool. Many item/rune effects are omitted and are displayed with each result. No claim of a live-game optimum, validated match strength or historical novelty is made. Champion growth uses engine AD growth when Data Dragon disagrees. Poison damage uses uniform proration, not a tick-accurate server simulation. No live AI provider is connected.

Save uses browser localStorage; JSON import/export provides portable scenarios. Full research exports are in `data/lol/16.20.1`. Generated browser data is in `public/data` and can be recreated with `npm run data`.

## Builds from this ChatGPT conversation

The default **Four builds per champion** collection contains 692 proposals: four for each of the 173 champions. Each uses an individually curated kit question and candidate package, with full items/runes, early-core priorities, comparison tests and failure conditions. These are a research first pass, not independently proven builds or mathematical maxima. **Earlier experiments** keeps the previous detailed Cassiopeia/Sett/Tahm proposals available. Only the selected champion's collection is downloaded.

Per-champion files are in `public/data/champion-builds`. The reproducible authoring inputs are `scripts/champion-build-intents.txt` and `scripts/build-recipes.mjs`; `npm run champion-builds` regenerates this collection. Requests and copied briefs target whichever collection is selected. Local dev and preview serve current workspace champion inboxes so revisions appear without rebuilding the frontend.

Open **Builds**, choose a champion, and expand **Request different builds from ChatGPT** to describe a goal. **Prepare request for this chat** saves your current goal and setup locally. Then tell this chat: “make the builds from my app request”. The assistant reads `data/requests/latest-build-request.json`, researches the kit, and writes full proposals to `public/data/chatgpt-builds.json`. The inbox refreshes automatically. This workflow uses this conversation without an API key; the app cannot send messages into it or run ChatGPT independently.

**Load into test bench** opens the editable setup and rune page for every champion. Review the conditions, test in Practice Tool or a match, then record observations. **Copy result for chat** includes the build identity and exact tested setup for a revision. Unfinished feedback survives section changes in session storage; saved results use local storage. **Undo last save** restores the draft. Browser storage retains up to 100 test records. Damage estimates cover only the implemented ability adapters and explicitly listed effects; manual gameplay observations are needed for the full hypothesis.

Run the app with `npm run dev` for local requests and live inbox updates. Vite preview also serves the current workspace inbox; a static deployment shows its bundled snapshot and uses **Copy request** instead of saving a local request.

Unofficial fan tool; League of Legends belongs to Riot Games.

## Champion-specific authored routes

Blitzcrank now has four independently authored objectives: hook/peel support control, AD/crit single-E ceiling, mana-shield repeated-E boxing, and an AP attack/lightning timing experiment. The AD route is a candidate to test, not a proven mathematical maximum. Its conditions distinguish E attack damage, critical strikes, Spellblade and rune packets.

Full authored overrides live in `scripts/champion-build-overrides/{alias}.json`. `npm run champion-builds` preserves these rather than replacing them with generic recipes. Blitzcrank uses new build IDs so historical feedback on the earlier proposals is not assigned to the new routes. Thresh, Warwick, Jax, Varus, Malzahar and Leona also have complete individual collections. Other champions retain the previous first-pass packages and need the same individual kit-focused revision. `BUILD_AUTHORING.md` records the kit-first standard; copied requests carry it forward.

## Roster interaction audit

`npm run interaction-audit` validates the individually authored research groups, publishes a per-champion interaction notebook, and regenerates the four-build collections. All champions are covered by two researched hypotheses plus rejected assumptions and source/proc uncertainties. These are not exhaustive proofs or game-verified results.

Open **Champion kit → Kit interactions to investigate** to review the mechanism, required state, candidate six items, falsification and a manual test. **Test this interaction** loads its exact proposal. Audited objectives deliberately use manual tests, including for Cassiopeia/Sett when the objective is outside their numerical adapters. Existing seven fully authored collections remain intact; elsewhere, two generic routes are replaced by the individually audited candidates.

The source snapshot is patch 26.20. Penetration/Spellblade family guards reject competing purchases; source shop flags still cannot establish every live availability condition. Published exclusions are documented in Riot’s [14.10 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-10-notes/) and [14.16 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-16-notes/); retained conditional source records remain explicit research caveats.

## Meta references and ability ceilings

Build collection now includes **Current meta references**: 30 role-specific patch 26.20 references checked 2026-10-13, with observed core, full source list, source rune identities and genuinely inferred substitutions kept separate. Each card links its provider and explains the kit-based playstyle, tradeoffs and matched-gold test. Match counts describe the champion-role cohort, not a six-item build sample. The snapshot is not an automatic live feed. Regenerate from authored research with `npm run meta-baselines`.

**Ability ceilings** supplies one individually selected finite-condition target for one of the 173 champions. Targets include ability/passive damage, healing, shields and execute thresholds. These are candidates, not certified maxima. `npm run ability-ceilings` validates and publishes the three authored research groups. The existing four-build collection remains available. Damage, healing and shielding feedback records retain separate metric identities; older damage records remain readable.

Cassiopeia, Tahm Kench and Blitzcrank include secondary OP.GG MCP and Lolalytics checks in Source & provenance. OP.GG returned current data without credentials, but its schema lacks patch/region filters. Lolalytics observations are explicitly its Highest Win Build selection, not a most-popular comparison. Exact observed requests/IDs and caveats live in `scripts/meta-crosschecks.json`; this is a checked snapshot, not an installed MCP or continuous feed.

## Full-roster provider references

Every one of the 173 champions now has OP.GG and Lolalytics references under **Builds → Current meta references**. The two cards show the matched role, observed core and full rune identities, core-build sample/win rate, champion-role cohort, source link, patch and check date. Lolalytics is explicitly its selected **Highest Win Build**; its rune statistics describe the primary keystone, not the entire page. OP.GG returns its own core definition; its public MCP does not expose patch/region filters. The selected main role comes from Lolalytics, with the existing 30 authored role contexts retained. This covers one comparison role per champion, not every possible lane.

`npm run provider-research` republishes the checked research data. To reacquire it, install `scripts/requirements-provider-research.txt` with Python pip, then run `npm run collect-provider-research`. Requests use bounded concurrency and resumable caches. For a new dated check use `npm run collect-provider-research -- --refresh --checked-at YYYY-MM-DD`, then publish. Failed acquisition retains the last complete authored/published snapshot; intermediate observations remain in `data/provider-research/*.pending.json`. Successful source payloads are cached only after extraction validates them. The app reads the checked snapshot, not a continuous API feed.

Collectors are tested with `python tests/provider_collectors_test.py`; app boundary and full-roster validation are included in `npm test`. A provider core is source evidence, not a generated complete six-item loadout. Existing authored six-item references and experiments remain separate below the provider cards.

## Updating to the latest meta data

The local app checks OP.GG and Lolalytics automatically when its last successful update is at least 24 hours old. **Daily updates** is enabled by default and can be turned off. **Update latest** starts a full-roster uncached fetch at any time. Progress and the last successful check are shown above the provider cards; browser reloads and multiple tabs join the same local job. Failed automatic runs have a 30-minute retry cooldown. Updates run while the app is open with `npm run dev`; static deployments and Vite preview display the bundled snapshot and disable live updates.

Each run downloads into an isolated folder, validates both providers for the complete local roster, then publishes immutable `versions/UUID` records and atomically changes the index pointer. Failed acquisition, validation, record writes or index replacement leave the previous snapshot intact. Old versions are retained. The client follows the validated pointer so cards switch together after completion, including on Windows where directory watcher locks prevent folder replacement.

Meta refreshes do not change the champion/item/rune formula catalog or rewrite authored experimental builds. If a provider reports a newer patch, cards flag the difference from the local formula snapshot. New item/rune identifiers require updating the base catalog before they can pass validation. OP.GG still controls its latest returned patch and does not expose a region/patch filter.

## GitHub Pages

The public app is published from `main` through `.github/workflows/pages.yml`. Assets and data use the repository base path. Pushes and the daily workflow fetch fresh provider data before deploying. A failed refresh stops deployment and retains the existing live site and its check date. The workflow can also be run manually; opting out of Refresh data deliberately publishes the checked-in snapshot.

GitHub Pages supports the static app: champion research, builds, partial numerical models, saved browser tests and exports. Local request-saving and instant provider refresh controls are available in `npm run dev`; the published site uses Copy request and checks the published provider index periodically. Game formulas and authored experiments retain their documented patch coverage.
