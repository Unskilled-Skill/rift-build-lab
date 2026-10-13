import fs from 'node:fs';
const catalog=JSON.parse(fs.readFileSync('public/data/catalog.json','utf8'));
const providers=['opgg','lolalytics'].map(p=>JSON.parse(fs.readFileSync(`scripts/provider-research/${p}.json`,'utf8')));
for(let n=0;n<providers.length;n++){
 const entries=providers[n],aliases=new Set(entries.map(s=>s.champion));
 if(entries.length!==catalog.champions.length||aliases.size!==catalog.champions.length||catalog.champions.some(c=>!aliases.has(c.alias)))throw new Error('Provider collection must cover the exact roster before publishing.');
 for(const s of entries){if(s.provider!==['opgg','lolalytics'][n]||!['available','unavailable'].includes(s.status))throw new Error('Invalid source identity.');if(s.status==='available'&&(!Array.isArray(s.observedCoreItemIds)||!s.observedCoreItemIds.length||s.observedCoreItemIds.some(id=>!catalog.items.some(i=>i.id===id))||!Array.isArray(s.observedRunePage)||s.observedRunePage.length!==6||s.observedRunePage.some(id=>!catalog.runes.some(r=>r.id===id))||!Number.isInteger(s.coreBuildMatches)||s.coreBuildMatches<1))throw new Error(`${s.champion}: incomplete provider data.`);}
}
const dates=new Set(providers.flatMap(entries=>entries.map(s=>s.checkedAt)));if(dates.size!==1||![...dates].every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)))throw new Error('Provider check dates must agree.');
const prepared=catalog.champions.map(c=>({version:1,patch:catalog.patch,champion:c.alias,sources:providers.map(entries=>entries.find(s=>s.champion===c.alias))}));
fs.mkdirSync('public/data/provider-research',{recursive:true});for(const p of prepared)fs.writeFileSync(`public/data/provider-research/${p.champion}.json`,JSON.stringify(p,null,2)+'\n');
const summary={version:1,patch:catalog.patch,checkedAt:[...dates][0],championCount:prepared.length,providers:Object.fromEntries(['opgg','lolalytics'].map((p,n)=>[p,{available:providers[n].filter(s=>s.status==='available').length,unavailable:providers[n].filter(s=>s.status==='unavailable').map(s=>s.champion)}]))};
fs.writeFileSync('public/data/provider-research/index.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
