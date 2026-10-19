import fs from 'node:fs';
import {validateCeilings} from './ability-ceilings.mjs';

const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const catalog=read('public/data/catalog.json');
const resources=read('scripts/champion-resources.json');
const entries=fs.readdirSync('scripts/ability-ceilings').filter(n=>/^group-\d+\.json$/.test(n))
 .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).flatMap(n=>read(`scripts/ability-ceilings/${n}`));
validateCeilings(entries,catalog,resources);
const pages=new Set(entries.map(e=>e.runePlan.runes.join(','))).size;
const clean=s=>s.replaceAll('|','/').replaceAll('\n',' ');
const lines=[
 '# Per-ability ceiling rune review',
 '',
 `Snapshot patch ${catalog.patch}. ${entries.length} explicit setups across ${catalog.champions.length} champions; ${pages} distinct legal six-rune pages.`,
 '',
 'These are objective-specific, reasoned candidates. They have not been certified by a complete numerical rune optimizer or tested in the game. Existing benchmark items, action counts, health, level and time remain the baseline. A separate keystone proc is not native ability output. Extra combat preparation is a separate comparison, except for stacks already explicitly recorded by the benchmark.',
 '',
 'Each authored entry stores its own six runes, three shards, per-rune reasoning, preparation, alternatives and exclusions. Repeated pages can be appropriate for similar coefficients; the selected ability and finite setup determine the reasoning. The app exposes these notes in each build’s test plan and coverage notes, and imports the exact selected page into its test form.',
 '',
 'Preparation is finite: Gathering Storm uses the authored time (usually minute 30); health shards use the recorded level. Overgrowth comparisons specify observed nearby deaths, legend stacks must be earned, and biscuits must actually be received and consumed or sold. Manaflow, item ramp, temporary movement speed, Conqueror and Hail of Blades are never automatically assumed active by these notes. Read the actual client counters and record all preparation when testing. The current damage adapters do not simulate every rune or stat conversion.',
 '',
 'Eligibility matters: generic finishers do not amplify native true damage or stat grants. Axiom is considered for eligible ultimate damage, healing and shielding, not simply every ability in the R slot. Attack speed matters for actual timing/counts or explicit conversions; it does not accelerate fixed-rate attacks. Revitalize is considered against the real heal/shield recipient state. A separate Aery, Guardian, Shield Bash or item packet cannot inflate the native heal/shield/ability measurement.',
 '',
 'Coefficient follow-up: Vel’Koz Deconstruction explicitly includes 0.6 AP; its true damage therefore benefits from AP stats even though penetration and generic damage finishers do not apply. Galio P/R, Malphite W/E and Taric E use adaptive offense/flex shards for their actual AP/AD terms alongside resistance scaling. Galio W uses adaptive offense for its AP term while retaining health flex for its independent bonus-HP term. Pure resistance or flat-percent objectives retain their distinct utility choices; this is not a uniform adaptive-shard rule.',
 '',
 'Sources: detailed coefficients and rune text use the repository’s extracted catalog and champion snapshot. Riot references: [26.20 patch](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-20-notes/), [Axiom changes in 25.5](https://www.leagueoflegends.com/en-au/news/game-updates/patch-25-05-notes/), [Press the Attack changes in 14.10](https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-10-notes/), and [Azir / Hail of Blades in 26.16](https://www.leagueoflegends.com/en-gb/news/game-updates/league-of-legends-patch-26-16-notes/). Unresolved pet, true-damage, transformed ability and snapshot interactions remain explicit manual checks.',
 '',
 'Reproduce: `npm run ability-ceilings`, `node scripts/audit-ability-ceilings.mjs`, `node scripts/audit-ceiling-runes.mjs`. Full structured plans are also in [the companion audit JSON](ability-ceiling-review.json).',
 '',
 'The complete setup inventory follows. Rune order is four primary rows followed by two secondary rows; shard IDs follow offense / flex / defense.',
 ''
];
for(const champion of [...catalog.champions].sort((a,b)=>a.alias.localeCompare(b.alias))){
 lines.push(`## ${champion.name||champion.alias}`,'');
 for(const e of entries.filter(e=>e.champion===champion.alias)){
  const p=e.runePlan;
  lines.push(`### ${clean(e.targetName)} (${e.key})`,'',
   `Runes: ${p.runes.map(id=>catalog.runes.find(r=>r.id===id).name).join(' → ')}. Shards: ${p.shards.join(' / ')}.`, '',
   p.reason, '', `Shard reasoning: ${p.shardReason}`, '',
   ...p.runeReasons.map(reason=>`- ${reason}`), '',
   `Preparation: ${p.setup.join(' ')}`, '',
   `Comparisons: ${p.alternatives.join(' ')}`, '',
   `Limits: ${p.exclusions.join(' ')}`, '');
 }
}
fs.writeFileSync('docs/ceiling-rune-review.md',lines.map(line=>line.trimEnd()).join('\n').trimEnd()+'\n');
console.log(`Rune review: ${entries.length} setups, ${catalog.champions.length} champions, ${pages} legal pages.`);
