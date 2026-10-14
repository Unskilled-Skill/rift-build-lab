# Numerical mechanics verification — October 14, 2026

The formula snapshot is patch **26.20**, Data Dragon **16.20.1**, retrieved October 10, 2026. Provider freshness does not update these formulas. These are bounded damage estimates, not a full combat simulator or in-game verification.

## Champion objectives

| Objective | Raw scored damage | Scope and confidence |
|---|---|---|
| Blitzcrank Power Fist | `2 × total AD + 0.25 × AP`, physical | Current exported E calculation. This is the entire empowered attack packet; do not add another ordinary attack. **Noncritical only**: crit scaling, Infinity Edge interaction, generic on-hit triggering, Sundered Sky, Muramana Shock and R lightning remain unverified and excluded. |
| Tahm Q | `[75,120,165,210,255] + AP`, magic; separate passive packet | Current Q explicitly applies passive to a champion. Q healing and CC excluded. |
| Tahm passive on Q | `5 × min(level,12) + 0.04 × bonus HP + 0.000125 × bonus HP × AP`, magic | Official 26.8 states base 5–60 at levels 1–12, 4% bonus HP and 1.25% AP per 100 bonus HP. The exported symbolic breakpoint has an additional level-12 bonus and ambiguous later extrapolation: **official 60 cap takes precedence**. |
| Tahm W | `[100,135,170,205,240] + 1.5 × AP`, magic | One successful landing. Full upfront mana charged; champion-hit refund excluded. |
| Tahm enemy R | `[100,250,400] + (0.15 + 0.0007 × AP) × target max HP`, magic | Rank clamped to 3. Assumes three existing passive stacks; preparatory hits excluded. Release/contact is scored directly; travel, duration, ally shield and stack simulation excluded. |

Primary records: [Blitzcrank export](../public/data/champions/Blitzcrank.json), [Tahm export](../public/data/champions/TahmKench.json), and their `data/lol/16.20.1/champions/raw/*.engine.json` source records. [Official 26.8 notes](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-8-notes/) establish the passive cap. [Official 26.20 notes](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-20-notes/) change Tahm Q healing; this does not change the damage objective.

All new casts require available mana (`min(entered current mana, calculated maximum mana)`) to cover their upfront cost. Mana costs: Blitz E 25; Tahm Q 50/46/42/38/34; W 60/75/90/105/120; R 100. These come from the current primary ability exports. Damage events use the same MR/armor resistance formula and shared item statistics as Cassiopeia and Sett. Percent armor penetration then flat armor penetration/lethality now apply to physical packets; magic penetration remains restricted to magic packets. Penetration cannot turn positive resistance negative.

## Items and runes

- **Muramana Awe**: current 26.20 catalog explicitly states 2% maximum mana as bonus AD. That stat conversion is included. Shock is excluded because Power Fist attack/ability proc interactions are not proven by a tooltip.
- **Seraph**: AP, mana and haste included. Current exported Awe text has a blank coefficient. Its old 14.1 rule was 2% **bonus** mana, not maximum mana; this does not verify the current rule, so **Awe conversion is omitted** and visibly reported for every equipped Seraph. Shielding excluded.
- **Trinity/Essence Spellblade**: explicit `spellbladeReady: true` opts into one separate physical source estimate after a successful Power Fist. Trinity uses 200% base AD; Essence uses 125% base AD plus 50 times crit chance as a fraction, capped at 100%. These rules come from official historical patch notes and **require current live confirmation**. No readiness is inferred, no proc is doubled by E, and no mana refund is modeled. Lich Bane's current coefficient is unresolved and omitted.
- **Infinity Edge**: current catalog AD included. Its catalog critical-damage stat does not prove E's crit behavior. Crit mode cannot turn this adapter into a verified critical estimate. All E results explicitly state noncritical coverage.
- **Gathering Storm**: only when selected and explicit `gatheringMinutes` is supplied. With `n = floor(minutes / 10)`, gain `4n(n+1)` AP or 60% of that amount in AD. Thirty minutes gives 48 AP / 28.8 AD. Omitted minutes mean zero elapsed-time bonus, not an invented match duration.
- **Adaptive shards/Conqueror**: stat preference compares bonus AD versus 60% AP after supported item conversions/amplifiers (Muramana, Bloodmail, Riftmaker and Deathcap) but before adaptive bonuses. Nonadaptive health shards are included before health-to-stat conversions. Projected item stats choose the preference; the same conversions are then applied once to rune-inclusive stats, so Deathcap is never multiplied twice. Ties use AD for Sett/Blitz and AP for the other modeled champions. Adaptive shards supply 9 AP / 5.4 AD; Conqueror supplies 1.8–4 adaptive force per entered pre-existing stack, capped at 12. Stack generation and healing excluded. Other rune effects, including First Strike, remain omitted.

Item/rune coefficients explicitly present in the snapshot use [catalog.json](../public/data/catalog.json). Historical reference rules: [official 14.1 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-1-notes/) (Seraph and Trinity) and [official 26.1 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/) (Essence). No gameplay observation has been added to this review; source estimates must not be labeled game-verified.

The expanded optimizer candidate list contains Seraph, Muramana, Infinity Edge, Trinity, Essence Reaver, Serylda, Collector, Runaan, Nashor and Lich Bane. Inclusion means their **available base statistics are candidates**, not that all their effects are supported. Objective-specific omissions accompany every result. Attack speed and secondary bolts have no value in a one-attack E objective. Collector's execute is a separate threshold and is excluded from numerical damage. Nashor on-hit and Lich Bane Spellblade coefficients are unavailable in this snapshot and omitted. Current legal item families still apply.

## Independent examples and regression evidence

`tests/model-adapters.test.ts` derives fixtures directly from the source coefficients, rather than using the implementation to generate expected results:

- Blitz: 60 base + 100 bonus AD, 200 AP → 370 raw physical → 185 at 100 armor.
- Tahm level1 Q, 1000 bonus HP, 200 AP: 275 Q + 70 passive → 172.5 at 100 MR.
- Tahm W rank5, 200 AP: 540 raw → 270 at 100 MR.
- Tahm R rank3, 200 AP, 3000 maximum target HP: 1270 raw → 635 at 100 MR.
- Ready Trinity, 60 base AD and no purchased stats: E 120 + Spellblade 120 raw → 120 total at 100 armor.
- Ready Essence with 25% crit chance and 60 base AD: separate Spellblade 87.5 raw; E remains 120 raw.
- Muramana with 1000 purchased mana and 450 base mana: 35 AD + 29 Awe AD; E = 248 raw.

The initial adapter/rune/coverage fixtures failed before implementation (13 failures for missing champion support, Gathering Storm and Seraph coverage warning). The Muramana fixture independently failed before adding its conversion. Existing engine fixtures remain green. Full `npm test` passed **20 files / 142 tests** at 15:47 local tool time; concurrent parent/UI edits may increase subsequent suite counts.

## Patch upgrade procedure

1. Refresh formula exports and record patch/version/retrieval date independently of provider refreshes.
2. Compare champion calculations, item passive coefficients, mana costs and rune raw effect values with this document and official notes.
3. Mark affected authored hypotheses and optimizer effects as stale or manual until reverified. Blank coefficients are omissions, never silently inherited historical values.
4. Re-run the independent numeric fixtures and full suite. Practice-tool checks must record actual crit outcome, proc readiness, stacks and damage packets before promoting a source estimate to game-verified behavior.

Adaptive preference regression: 100 AP / 70 bonus AD with Deathcap and one adaptive shard must choose AP: (100 + 9) × 1.3 = 141.7 AP, 70 bonus AD; E raw = 295.425. Without this ordering it incorrectly chooses AD. Separate Riftmaker and Bloodmail fixtures prove HP conversions also affect preference. All three fixtures failed before the ordering repair and passed afterward.

# Cassiopeia boots correction

Riot's [26.1 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/) explicitly replace the old no-boots passive with movement-buff amplification. The [26.18 notes](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-18-notes/) adjust the amplification to 5–36%; 26.20 changes base health and mana. The authored no-boots explanation was stale and is corrected in both its source input and published ceiling. Six damage items remain a finite experiment with a movement tradeoff, not a champion purchase requirement.

