import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import {objectiveOptions,FORMULA_COMPAT} from '../src/model-support';
const rows=catalog.champions.map(c=>({name:c.name,objectives:objectiveOptions(c.alias)}));
const count=rows.reduce((n,c)=>n+c.objectives.length,0);
const report=`# Shared combat calculation coverage

Patch ${catalog.patch}; formula compatibility ${FORMULA_COMPAT}. Generated from the actual objective registry.

${rows.length} champions have ${count} selected damage objectives passing through the common pipeline. This is **partial damage coverage**, not full simulation of every champion kit or of all 476 authored ceiling metrics. Healing, shielding, maximum-stat and many multi-action ceilings still need manual game tests.

## Included layers

- Prepared rune stats: Conqueror, finite Gathering Storm, Bloodline, Alacrity, Legend Haste, Manaflow, biscuits, Overgrowth, earned Grasp HP, Absolute Focus, Jack, Transcendence, Waterwalking, Lethal Tempo AS and Hail AS. Counter values are supplied, never earned by equipping a rune.
- Prepared defenses and conversions: Conditioning, Unflinching, Aftershock, Jak’Sho and Terminus; active Hubris, Sterak base AD, Seraph bonus-mana AP, Muramana mana AD, and existing item/champion conversions. Hecarim requires observed movement speed after soft caps. Combined temporary-buff ordering remains approximate.
- Live damage conditions: Cut Down, Coup, Last Stand, prepared PTA, classified Axiom, prepared Shojin, Riftmaker/Liandry ramps, in-range Abyssal, Shadowflame and entered-target-bonus-HP Giant Slayer. Prepared Cleaver shred precedes penetration.
- Separate ready proc packets: Comet, Aery, Scorch, Dark Harvest, First Strike, Hail damage, Deathfire, Liandry burn, Luden, Nashor, Spellblade, Rapid Firecannon, Titanic primary on-hit, Heartsteel and Terminus. Muramana identifies distinct modeled casts, excluding duplicate ticks of one cast. Eligibility depends on delivery classification; unrelated spells never gain automatic attacks.
- Purge uses its pinned OnHitDamageReduction=0.5 for supported on-hits; special Heartsteel/Energized eligibility stays excluded pending verification. Hybrid spell/on-hit delivery is explicitly tagged for Ezreal Q, Gangplank Q and Irelia Q. Other unresolved hybrid, pet and attack mechanics remain partial.

The result reports native damage, proc damage, capped effective HP removed and per-effect notes. Default scoring is uncapped potential; stop-at-death drops subsequent packets. Native DOTs use normalized quarter-second slices, burns use documented integrated tick approximations, and threshold checks use current simulated target HP. Same-time procs resolve after their own native packet, before the next native packet. Proc outputs never trigger further procs; First Strike excludes item/rune output and is not amplified twice. Spellblade is armed once; no later cast is invented to rearm it.

## Limits and provenance

Unlisted item/rune effects, full crit/attack schedules, dynamic stack generation/expiry, healing/shields, execute thresholds, projectile travel and detailed client proc ordering are not universally simulated. Lethal Tempo max-stack damage, Rageblade Phantom Hit, Titanic active/splash and Collector execute are examples of remaining gaps. Lethal Tempo has conflicting ranged helper/explicit values in the snapshot; this pass does not silently invent a damage coefficient. Existing champion source notes still apply. A legal build with a finite result does not prove exact client parity or maximum possible damage.

The compact item calculation fixture is [combat-source-evidence.json](../scripts/combat-source-evidence.json), extracted from the [pinned 16.20 game item records](https://raw.communitydragon.org/16.20/game/items.cdtb.bin.json). Rune raw values/calculations and champion engine records are retained in the published patch snapshot. Regression tests check shared coefficients, preparation validation, conversion order, delivery eligibility, no recursive procs, finite-target stopping and every registered champion/objective. In-game parity remains pending.

Website and desktop frontend build separately. Formula compatibility was bumped to ${FORMULA_COMPAT}; older installed desktop binaries cannot gain these engine changes from a data-only refresh and require a new desktop release.

## Purchase timing

Authored/meta plans prioritize owned Rod of Ages, Heartsteel and Hubris earlier, with inferred-order labels. An early Tear is a recall option for its upgrades. The damage planner offers stacking-time constraints and a separate opt-in early Collector preference after a core spike. Collector’s 25 gold per kill does not grant forecast income; four eligible kills only add 100 gold. Time, target access, takedowns and the cost of delaying another item determine actual value. No future stacks or snowball gold are fabricated in damage scoring.

## Additional native-action interactions (2026-10-20)

Grasp includes one explicitly charged 3.5% owner-max-HP hit (40% effective at range). PTA counts eligible deliveries, accepts 0–2 prior hits, respects its gap/cooldown, and activates amplification only after its burst resolves. Electrocute accepts 0–2 prior actions, counts distinct native actions within three seconds and enforces its cooldown; a DOT tick or multi-hit packet cannot invent a third action. Cheap Shot requires explicit impairment shared by both comparison targets. Sudden Impact requires an explicitly armed four-second opening window. None generates free preparation or recursive proc triggers.

Wit’s End adds the pinned 45 magic damage; Rageblade adds 30 magic per delivery and 8% AS per prepared stack (0–4). Phantom Hit remains excluded. BotRK uses 9% melee / 6% ranged current-HP damage, sampled at its modeled impact after the native packet and prior procs, rather than using maximum HP for every delivery. Reduced-effectiveness delivery factors are retained. The minimum-damage floor and exact client same-frame ordering remain unverified.

Explicit attack delivery classification was added for Trundle, Nasus, Garen, Yorick, Xin Zhao and Volibear Q, Camille Q1 and Renekton W. Renekton W’s strikes can apply multiple on-hits/PTA hits, while Hail and Electrocute see one native action. Combined attack/ability packets do not establish exact Shojin amplification of the bonus portion. Camille Q2 conversion, other unresolved hybrid attacks and arbitrary combo timing still require separate adapters/client verification.

These additions are regression-tested individually and together through every registered champion objective. Formula compatibility 3 requires a new desktop binary beyond release 0.1.3; a data-only refresh cannot add calculation code. Source notes and the compact evidence fixture remain the coefficient authority for patch 26.20.

## Registered objectives

| Champion | Partial damage objectives |
| --- | --- |
${rows.map(c=>'| '+c.name+' | '+c.objectives.map(o=>o.label.replaceAll('|','\\|')).join('; ')+' |').join('\n')}
`;
fs.writeFileSync('docs/combat-calculation-coverage.md',report);
console.log(`Combat registry: ${rows.length} champions, ${count} partial damage objectives; formula compatibility ${FORMULA_COMPAT}.`);
