import {it,expect} from 'vitest';
import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import resources from '../scripts/champion-resources.json';
import {parseChatBuilds,parseChampionBuilds} from '../src/chat-builds';
import type {Catalog} from '../src/types';
it('ships exactly four distinct, valid proposals for every champion',()=>{
 const index=JSON.parse(fs.readFileSync('public/data/champion-builds/index.json','utf8'));
 expect(index.patch).toBe('26.20');
 expect(index.champions.map((c:{alias:string})=>c.alias).sort()).toEqual(catalog.champions.map(c=>c.alias).sort());
 const ids=new Set();let count=0;
 for(const champion of catalog.champions){
  const builds=parseChatBuilds(fs.readFileSync(`public/data/champion-builds/${champion.alias}.json`,'utf8'),catalog as unknown as Catalog);
  expect(builds).toHaveLength(4);
  expect(new Set(builds.map(b=>[...b.itemIds].sort((a,b)=>a-b).join(','))).size).toBe(4);
  for(const b of builds){expect(b.champion).toBe(champion.alias);expect(ids.has(b.id)).toBe(false);ids.add(b.id);count++}
 }
 expect(count).toBe(692);
});
it('rejects a wrong-champion or incomplete collection before displaying it',()=>{
 const text=fs.readFileSync('public/data/champion-builds/Aatrox.json','utf8');
 expect(parseChampionBuilds(text,catalog as unknown as Catalog,'Aatrox')).toHaveLength(4);
 expect(()=>parseChampionBuilds(text,catalog as unknown as Catalog,'Ahri')).toThrow();
 const input=JSON.parse(text);input.builds.pop();expect(()=>parseChampionBuilds(JSON.stringify(input),catalog as unknown as Catalog,'Aatrox')).toThrow();
});
it('does not buy mana or select Manaflow for champions without mana',()=>{
 for(const [alias,resource] of Object.entries(resources)){
  if(resource==='Mana')continue;
  const builds=parseChampionBuilds(fs.readFileSync(`public/data/champion-builds/${alias}.json`,'utf8'),catalog as unknown as Catalog,alias);
  for(const b of builds){expect(b.runePage).not.toContain(8226);for(const id of b.itemIds){const item=catalog.items.find(i=>i.id===id)!;expect(item.baseStats.some(s=>s.name==='Mana'&&s.value>0)).toBe(false)}}
 }
});

it('preserves individually authored collections when roster interactions are regenerated',()=>{
 for(const file of fs.readdirSync('scripts/champion-build-overrides')){
  const authored=JSON.parse(fs.readFileSync(`scripts/champion-build-overrides/${file}`,'utf8'));
  const published=JSON.parse(fs.readFileSync(`public/data/champion-builds/${file}`,'utf8'));
  // The ranked Reference replaces one authored route; the other three stay exactly as written.
  const kept=published.builds.filter((b:{ranked?:unknown})=>!b.ranked);
  expect(kept).toHaveLength(3);for(const b of kept)expect(authored.builds).toContainEqual(b);
 }
});
