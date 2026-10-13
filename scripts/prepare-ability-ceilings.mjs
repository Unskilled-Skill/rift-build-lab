import fs from 'node:fs';
import {validateCeilings,ceilingBuild} from './ability-ceilings.mjs';
const catalog=JSON.parse(fs.readFileSync('public/data/catalog.json','utf8')),resources=JSON.parse(fs.readFileSync('scripts/champion-resources.json','utf8'));
const entries=[1,2,3].flatMap(n=>JSON.parse(fs.readFileSync(`scripts/ability-ceilings/group-${n}.json`,'utf8')));
validateCeilings(entries,catalog,resources);
const prepared=catalog.champions.map(c=>({version:1,patch:catalog.patch,champion:c.alias,author:'ChatGPT',authoredAt:'2026-10-13',builds:entries.filter(e=>e.champion===c.alias).map(e=>ceilingBuild(e,JSON.parse(fs.readFileSync(`public/data/champions/${c.alias}.json`,'utf8')),catalog,resources))}));
fs.mkdirSync('public/data/ability-ceilings',{recursive:true});for(const p of prepared)fs.writeFileSync(`public/data/ability-ceilings/${p.champion}.json`,JSON.stringify(p,null,2)+'\n');
fs.writeFileSync('public/data/ability-ceilings/index.json',JSON.stringify({version:1,patch:catalog.patch,championCount:prepared.length,targetCount:entries.length,method:'Individually selected finite-condition ability ceiling candidates; not exhaustive solver results.',champions:prepared.map(p=>({alias:p.champion,count:p.builds.length}))},null,2)+'\n');
console.log(`Prepared ${entries.length} ability ceilings for ${prepared.length} champions.`);
