import fs from 'node:fs';
import path from 'node:path';
import {validateInteractionAudit,interactionBuild} from './interaction-audit.mjs';
const catalog=JSON.parse(fs.readFileSync('public/data/catalog.json','utf8'));
const resources=JSON.parse(fs.readFileSync('scripts/champion-resources.json','utf8'));
const entries=[1,2,3].flatMap(n=>JSON.parse(fs.readFileSync(`scripts/interaction-audit/group-${n}.json`,'utf8')));
validateInteractionAudit(entries,catalog,resources);
const prepared=entries.map(entry=>{
 const kit=JSON.parse(fs.readFileSync(`public/data/champions/${entry.champion}.json`,'utf8'));
 const sourceCoverage=['P','Q','W','E','R'].map(slot=>({slot,name:slot==='P'?kit.passive.name:kit.primaryAbilities.find(a=>a.slot===slot)?.name||slot,paths:kit.allSpellRecords.filter(s=>s.primarySlot===slot||(slot==='P'&&s.name===kit.passive.name)).map(s=>s.path)}));
 return {version:1,patch:catalog.patch,...entry,sourceCoverage,builds:entry.opportunities.map(o=>interactionBuild(entry,o,kit,catalog,resources))};
});
const root='public/data/interaction-audit';fs.mkdirSync(root,{recursive:true});
for(const entry of prepared)fs.writeFileSync(path.join(root,entry.champion+'.json'),JSON.stringify(entry,null,2)+'\n');
fs.writeFileSync(path.join(root,'index.json'),JSON.stringify({version:1,patch:catalog.patch,reviewedAt:'2026-10-13',championCount:entries.length,opportunityCount:entries.reduce((n,e)=>n+e.opportunities.length,0),method:'Source-based review of primary kit/passive and relevant form/helper records; individually authored hypotheses, not exhaustive proof or in-game verification.',champions:entries.map(e=>e.champion)},null,2)+'\n');
console.log(`Prepared ${entries.length} champion audits and ${prepared.reduce((n,e)=>n+e.builds.length,0)} interaction builds.`);
