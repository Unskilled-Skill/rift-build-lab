import fs from 'node:fs';
import {validateCeilingReviewLedger} from './ceiling-review-ledger.mjs';

const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const catalog=read('public/data/catalog.json'),resources=read('scripts/champion-resources.json');
const entries=fs.readdirSync('scripts/ability-ceilings').filter(n=>/^group-\d+\.json$/.test(n))
 .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).flatMap(n=>read(`scripts/ability-ceilings/${n}`));
const reviewDir='scripts/ability-ceilings/reviews';
const reports=fs.readdirSync(reviewDir).filter(n=>/^part-[a-z]+\.json$/.test(n)).sort().map(n=>read(`${reviewDir}/${n}`));
const context=read(`${reviewDir}/context.json`);
const kits=Object.fromEntries(catalog.champions.map(c=>[c.alias,read(`public/data/champions/${c.alias}.json`)]));
const summary=validateCeilingReviewLedger(entries,catalog,resources,context,reports,kits);
const clean=s=>s.replaceAll('|','/').replaceAll('\n',' ').trim();
const lines=[
 '# Full ceiling setup audit', '',
 `Patch ${summary.patch}, reviewed ${summary.reviewedAt}: **${summary.targetCount} targets across ${summary.championCount} champions**. ${summary.correctedCount} setups corrected; ${summary.retainedCount} retained after this review.`, '',
 'This audit checks the complete authored ceiling inventory against the extracted champion, item and rune snapshot. Each record states the native scaling, rune and shard reasoning, preparation assumptions, and remaining client checks. The ledger binds each review to the exact authored entry, selected formula evidence and complete catalog/champion snapshot; edits to those inputs invalidate the review rather than silently retaining a reviewed label.', '',
 'A retained setup is a source-based candidate, not a claim of mathematical optimality or in-game verification. Separate proc output, real hit ordering, caps, snapshot behavior, target survival and earned preparation remain part of testing. No globally optimal build or win-rate claim follows from passing this audit.', '',
 'Reproduce with `npm run audit:ceilings`. The ledger is development data and is not loaded by the website or desktop app. Setup corrections and their test instructions are published through the existing champion-specific build files.', '',
 '| Champion | Target key | Decision | Changes | Remaining checks |',
 '|---|---|---|---|---|',
 ...summary.targets.map(r=>`| ${r.champion} | ${r.key} | ${r.decision} | ${r.changes.length} | ${r.manualChecks.length} |`), '',
 '## Per-target review', ''
];
for(const row of summary.targets){
 lines.push(`### ${row.champion} — ${row.key}`, '',
  `Decision: ${row.decision}.`, '',
  `Scaling: ${clean(row.scalingSummary)}`, '',
  `Runes: ${clean(row.runeAssessment)}`, '',
  `Shards: ${clean(row.shardAssessment)}`, '',
  `Preparation: ${clean(row.preparationAssessment)}`, '',
  `Changes: ${row.changes.length?row.changes.map(clean).join(' '):'Retained after source and setup review.'}`, '',
  `Client checks: ${row.manualChecks.length?row.manualChecks.map(clean).join(' '):'The general unverified-client limitations above still apply.'}`, '',
  `Sources: ${row.sourcePaths.map(p=>'`'+p+'`').join(', ')}.`, '');
}
fs.writeFileSync('docs/ceiling-full-audit.md',lines.join('\n').trimEnd()+'\n');
console.log(`Full ceiling audit: ${summary.targetCount}/${entries.length} targets, ${summary.championCount} champions, ${summary.correctedCount} corrected, ${summary.retainedCount} retained; source/input hashes match. In-game validation remains pending.`);
