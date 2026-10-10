# Tahm Kench experiments — patch 26.20

User requested the same full-build research/test workflow as Cassiopeia. Added six Tahm proposals, preserving all previous builds. Every proposal has six items, a legal rune page/shards, an explicit hypothesis, comparison tests, purchase priorities and failure conditions. Tahm has no numerical adapter: proposals load into the manual test sheet, without a fabricated damage estimate.

## Reasoning from the current kit

The passive source has `4% bonus HP + (1.25% AP per 100 bonus HP)` on top of level-based damage. The interaction term is `0.000125 * bonusHP * AP`. At a hypothetical 2000 bonus HP, another 100 AP adds 25 passive magic damage per application. At 400 AP, another 1000 bonus HP adds 90 passive damage: 40 from health plus 50 from the health/AP interaction. These are formula inferences before MR, not complete build results. Riftmaker's health-to-AP conversion introduces another link, but survival and actual attacks determine whether any extra on-hit damage is useful.

Q has 100% AP scaling, W 150%. Enemy R's target-max-health ratio is `15% + 0.07% per AP`; 500 AP therefore implies a 50%-max-health component before resistance, plus flat damage. It is magic damage, not true damage, and still requires three passive stacks. Q's three-stack stun consumes the stacks, so an attack-to-R test must not quietly award the same stacks to both Q and R.

Patch 26.20 increases Q base healing to 10/20/30/40/50. Rank-5 Q source healing is `50 + 7% missing HP`: at 1000 missing HP, 120 before modifiers. E uses stored damage for either an active shield or eventual healing. Its storage differs with one versus at least two nearby enemy champions. Do not count one pool twice.

## Test order

1. **Control: durable river king** — Heartsteel, Unending, Visage, Abyssal, Jak'Sho, Steelcaps. Establish damage before death and successful stack access. MR purchases are conditional; Heartsteel is not mandatory in a losing matchup.
2. **Hybrid appetite** — Heartsteel, Riftmaker, Nashor, Unending, Visage, Steelcaps. Highest-priority offensive comparison. Health/AP scaling and real attack speed may buy more passive applications and faster three-stack access. Compare the two-item path and full build against the control.
3. **Double taste** — Heartsteel, Dusk and Dawn, Nashor, Riftmaker, Jak'Sho, Mercury boots. First isolate the Spellblade repeated-on-hit interaction. Additional passive damage does not establish an additional stack; record both. The item's zero cooldown placeholder and unresolved formula are not reliable live values. Use only one Spellblade item.
4. **Devour detonation** — Heartsteel, Riftmaker, Deathcap, Void, Zhonya, Mercury boots. Riskier AP window. Record deaths before three stacks/R, not just the damage of a successful spit. Compare defense versus Deathcap, and offensive R versus ally rescue value.
5. **Two-fight engine** — Heartsteel, Warmog, Riftmaker, Unending, Visage, Steelcaps. Measure a first fight, successful disengage, actual regeneration delay and second fight. Warmog does not heal through incoming combat damage; percent-health damage and inability to leave can defeat the idea.
6. **Rescue specialist** — Celestial Opposition, Locket, Redemption, Knight's Vow, Mikael, Mercury boots. A support-budget comparison. Track carry survival and damage lost during Devour. Celestial is a quest transformation, not a directly purchased 400-gold legendary. Visage on Tahm is not an automatic amplifier of his ally's R shield. Mikael does not remove airborne/suppression.

## Feedback

Record role/matchup, level, ranks, gold spent, item/quest states, actual AP/bonus HP, finite health stacks, starting mana, attacks/Q hits, time to three stacks, total damage, survival, healing/shield absorption and what stopped the plan. For support, add ally survival and lost carry uptime. Repeat three times, match conditions, and isolate item changes before rune changes. No claim of historical novelty, optimality or proven strength.

Sources: local Tahm champion symbolic formulas and item/rune snapshot; [Riot 26.8 passive adjustment](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-8-notes/), [Riot 26.20 Q healing buff](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-20-notes/).

Verification: 27 tests pass, including all proposals' legal items/runes and loadable scenarios. TypeScript/Vite production build passes. Manual game measurements remain pending user feedback.
