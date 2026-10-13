import fs from 'node:fs';
import {validateMeta,metaBuild} from './meta-baselines.mjs';
const catalog=JSON.parse(fs.readFileSync('public/data/catalog.json','utf8')),resources=JSON.parse(fs.readFileSync('scripts/champion-resources.json','utf8')),entries=JSON.parse(fs.readFileSync('scripts/meta-baselines.json','utf8'));
validateMeta(entries,catalog,resources);
const crosschecks=JSON.parse(fs.readFileSync('scripts/meta-crosschecks.json','utf8'));
const builds=entries.map(e=>metaBuild(e,JSON.parse(fs.readFileSync(`public/data/champions/${e.champion}.json`,'utf8')),catalog,resources));
for(const b of builds){const c=crosschecks.find(c=>c.champion===b.champion);if(c)b.meta.crosschecks=['opgg','lolalytics'].map(provider=>{const s=c[provider];return {provider,sourceURL:s.sourceURL,sourcePatch:s.sourcePatch,selection:provider==='lolalytics'?s.buildSelection:'Returned core; provider definition',observedCoreItemIds:s.observedCoreItemIds,observedRunePage:s.observedRunePage,coreBuildMatches:s.coreBuildMatches,checkedAt:c.checkedAt,limits:provider==='opgg'?s.limits:s.baselineComparison.limits};});}
fs.writeFileSync('public/data/meta-baselines.json',JSON.stringify({version:1,patch:catalog.patch,author:'ChatGPT',authoredAt:'2026-10-13',builds},null,2)+'\n');console.log(`Prepared ${builds.length} sourced meta references.`);
