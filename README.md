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

Open **ChatGPT builds**, choose a champion, and describe a goal. **Prepare request for this chat** saves your current goal and setup locally. Then tell this chat: “make the builds from my app request”. The assistant reads `data/requests/latest-build-request.json`, researches the kit, and writes full proposals to `public/data/chatgpt-builds.json`. The inbox refreshes automatically. This workflow uses this conversation without an API key; the app cannot send messages into it or run ChatGPT independently.

Six initial Cassiopeia/Sett proposals include complete item and rune pages, test conditions, tradeoffs and failure cases. **Load & test this build** opens the workbench and a manual test sheet. Record observations from Practice Tool or a match, then export the results and share them here for a revision. Browser storage retains up to 100 test records. Damage estimates cover only the implemented ability adapters and explicitly listed effects; manual gameplay observations are needed for the full hypothesis.

Run the app with `npm run dev` for local requests and live inbox updates. Vite preview also serves the current workspace inbox; a static deployment shows its bundled snapshot and uses **Copy request** instead of saving a local request.

Unofficial fan tool; League of Legends belongs to Riot Games.
