# Cassiopeia experiment batch — patch 26.20

The user asked for carefully reasoned builds to test and give feedback on. Added five full proposals to the app, preserving the three earlier Cassiopeia and three Sett proposals. Every proposal includes six distinct items, a complete rune page, shards, conditions, purchase priorities, failure cases and an in-game comparison.

## Why these tests

Current source formulas imply rank-5 poisoned E at level 18 deals approximately `240 + 0.65 AP` raw magic damage and heals for `0.16 AP` before modifiers. Q deals `205 + 0.75 AP` over three seconds. E costs 45 mana. Riot's 26.18 notes confirm the E mana/ratio changes; 26.20 reduces starting health to 610 and mana to 450. Early resources and real cast uptime therefore matter.

At a hypothetical 500 AP, an empowered E is about 565 raw damage. Another 100 AP adds 65 per E, about 11.5%. In a simplified window with one full Q plus ten empowered E casts, two extra E casts add about 18.1% damage, versus about 11.6% from another 100 AP. This is an inference from the ability formulas, not a full build simulation: burns, shields, rune effects, timing, target health and movement can change the result. It explains why testing survival/access alongside AP is worthwhile.

1. **Control: venom carry** — Seraph, Rylai, Liandry, Deathcap, Void, Swifties. Establish a repeatable reference. Two-item performance and damage actually landed matter as much as full-build damage.
2. **Resistance erosion** — Seraph, Bloodletter, Liandry, Cosmic, Deathcap, Swifties; Deathfire Touch. Highest-priority unusual comparison. Measure Bloodletter ramp versus immediate Void penetration, then isolate the rune swap. Allied magic damage may justify the reduction even if personal damage is lower. The selected Bloodletter ID is the Summoner's Rift version 8010, not Arena 4010.
3. **Frozen-fang duelist** — Seraph, Frozen Heart, Rylai, Liandry, Deathcap, Steelcaps. Conditional physical matchup test: does armor and the nearby attack-speed reduction buy enough E casts? Extra mana's Seraph conversion is unresolved in the export and must be read in game. This build deliberately lacks percentage penetration; test a Void substitution into MR.
4. **Sustain engine** — Seraph, Riftmaker, Visage, Rylai, Deathcap, Mercury boots. Conditional sustained magic-damage test. At 500 AP, source E healing is 80; Visage alone suggests 100 before other modifiers. More AP also raises healing, so replacing AP with defense is not automatically a sustain gain. Isolate healing, then test the whole fight with and without healing reduction. No armor or percentage penetration is a serious weakness.
5. **Spellblade weave** — Seraph, Lich Bane, Rylai, Deathcap, Void, Sorcerer shoes. Intentionally low confidence. Real attacks must consume Spellblade; E does not deliver on-hit effects. The shorter attack range and time spent attacking may cost more empowered E casts than the proc adds. Test occasional ready-proc attacks, not an attack after every E.

## Ideas rejected or constrained

- Fimbulwinter does not create a repeatable shield from ranged Rylai slows: its source slow trigger is melee-only. Immobilization may trigger a shield, but Cassio's conditional R stun is not a frequent E-loop trigger. The item also competes with Seraph in the Tear family.
- Nashor/Rageblade attack speed does not reduce Twin Fang's spell cooldown. An attack build would need to justify actual attacks on their own rather than claim E inherits their on-hit effects.
- More haste only pays when mana, poison uptime, casting/latency and target access support additional casts. The app is not a tick-accurate movement/cast simulator.
- Rune damage or healing cannot be inferred from the partial calculator ranking. The experiments begin unstacked and ask for measured rune contribution.

## Feedback needed

For each build: champion level and item/Tear states; opponent and HP/MR; gold spent; starting available mana; damage and E casts; survival time; missed Qs; actual rune damage; and what prevented the plan from working. Three repeatable trials provide a better first signal than a best-case single result. Use the control page when isolating an item change, then change the keystone separately.

Sources: [Riot patch 26.20](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-20-notes/), [Riot patch 26.18](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-18-notes/), local champion symbolic formulas and item/rune snapshot at `data/lol/16.20.1` / `public/data`.

Validation: 27 tests pass, including all shipped proposals' legal item/rune/scenario checks; TypeScript/Vite production build passes. No in-game results have been fabricated. The app displays eight Cassiopeia builds.
