# Rift Build Lab

Local League of Legends build research app. Patch 26.20 / Data Dragon 16.20.1 snapshot.

```powershell
npm install
npm run data
npm run dev
```

Open the local URL printed by Vite (normally http://127.0.0.1:5173). `npm run build` regenerates the data bundle, checks TypeScript and builds the production app. `npm test` runs independent calculation, constraint and import fixtures.

All 173 champions have kit data, source formula browsers and precomputed AI-authored experimental item cores. The catalog contains all 870 item records and 69 runes/shards; source flags do not establish live availability.

Numerical adapters cover Cassiopeia Q/E and Sett W. Search ranks a limited model over a small curated candidate pool. Many item/rune effects are omitted and are displayed with each result. No claim of a live-game optimum, validated match strength or historical novelty is made. Champion growth uses engine AD growth when Data Dragon disagrees. Poison damage uses uniform proration, not a tick-accurate server simulation. No live AI provider is connected.

Save uses browser localStorage; JSON import/export provides portable scenarios. Full research exports are in `data/lol/16.20.1`. Generated browser data is in `public/data` and can be recreated with `npm run data`.

Unofficial fan tool; League of Legends belongs to Riot Games.
