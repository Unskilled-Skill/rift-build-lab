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
