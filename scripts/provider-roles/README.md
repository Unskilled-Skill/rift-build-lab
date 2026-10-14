# Optional observed roles

This collection supplements the existing single-role, two-provider roster. Candidate targets in `scripts/provider-role-targets.json` are acquisition requests, not a list of supported roles. A role becomes selectable only when present in the published `public/data/provider-roles/index.json`.

Refresh with the existing collector Python environment (BeautifulSoup is already required):

```sh
python scripts/collect-provider-roles.py --checked-at YYYY-MM-DD
node scripts/prepare-provider-roles.mjs
```

The first command makes fresh requests, keeps raw response caches and rejected attempts under ignored `data/provider-roles/acquisition-cache`, and writes only qualifying observations to `scripts/provider-roles/observations.json`. The optional `--targets FILE` argument supports 1–40 explicit champion-role pairs; `--output-dir DIRECTORY` isolates acquisition. The publisher also supports `--input-file FILE`. Publish and deploy only after validation succeeds. Neither command changes the default provider snapshot. The collector preserves prior authored observations if no pair qualifies.

Each role requires two available sources with an observed role-specific core sample of at least 100 each. Lolalytics must additionally report at least 1,000 champion-role games, with a matching explicit lane, GLOBAL, Emerald+, Ranked Solo/Duo. OP.GG must return the requested champion and position, Ranked, Emerald+. OP.GG exposes no verified region/patch request controls; the returned trend supplies its source patch. Its summary game count can repeat between positions and must **not** be described as a verified role cohort. Alternate OP.GG sources disclose this as `sampleScope: champion_summary_unverified`; Lolalytics uses `champion_role`. Samples and thresholds do not prove superiority.

The publisher validates dates, exact provider pairs, matched roles, scope, legal local items/runes/shards, and sample counts before writing. The index declares the cohort threshold provider and both core-sample providers. `index.champions[alias]` lists only qualified roles, and `index.recordsDirectory` points to immutable champion records. Read `/data/provider-roles/${index.recordsDirectory}/${alias}.json`; each record contains `{version, patch, champion, roles: [{role, sources}]}`. Source arrays retain the existing two-provider schema. Only replace the index after all champion records have been written, so failed validation retains the previous publication. Missing/unlisted roles are unavailable; never synthesize a role from the default build.

Initial acquisition: 18 qualified alternate champion-role pairs across 16 champions from 20 candidates, checked 2026-10-15. Brand jungle and Karma mid did not meet core sample thresholds and were excluded. This is bounded coverage, not all possible lanes for the entire roster. The source observations contain real cores/runes and marginal item options; they do not establish an observed joint six-item inventory. Any full completion must remain separately identified as inferred.
