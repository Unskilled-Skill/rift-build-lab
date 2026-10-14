import fs from 'node:fs';

// Keep the reviewed table independent of changing provider observations.
// Runtime completion uses the current validated provider core and this kit plan.
const catalog=JSON.parse(fs.readFileSync('public/data/catalog.json','utf8'));
const authored=JSON.parse(fs.readFileSync('scripts/champion-meta-plans.json','utf8'));
if(authored.version!==1||authored.patch!==catalog.patch||!Array.isArray(authored.plans)||authored.plans.length!==catalog.champions.length)throw Error('Expected a current-patch plan for every champion.');
const aliases=new Set(catalog.champions.map(c=>c.alias));
const items=new Set(catalog.items.map(i=>i.id));
for(const p of authored.plans){
 if(!aliases.delete(p.champion)||!['top','mid','adc','jungle','support'].includes(p.role)||!Array.isArray(p.preferredItemIds)||p.preferredItemIds.length!==6||new Set(p.preferredItemIds).size!==6||!Array.isArray(p.situationalItemIds)||[...p.preferredItemIds,...p.situationalItemIds].some(id=>!items.has(id))||!p.traits||typeof p.summary!=='string'||!Array.isArray(p.notes))throw Error(`Invalid reviewed plan: ${p.champion}`);
}
if(aliases.size)throw Error('Missing champion plans.');
fs.writeFileSync('public/data/champion-meta-plans.json',JSON.stringify(authored,null,2)+'\n');
console.log(`Published ${authored.plans.length} reviewed champion meta plans. Run npm test to validate legal completions against the provider snapshot.`);
