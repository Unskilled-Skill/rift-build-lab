import {it,expect} from 'vitest';
import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import timing from '../public/data/item-timing.json';
import type {Catalog} from '../src/types';
import {parseChampionBuilds} from '../src/chat-builds';
import {legalBuild} from '../src/build-rules';
import {rankedSafeVariant,buildProof} from '../src/build-proof';
const data={...(catalog as unknown as Catalog),itemTiming:timing as never};
const item=(id:number)=>data.items.find(i=>i.id===id)!;
const all=data.champions.flatMap(c=>parseChampionBuilds(fs.readFileSync(`public/data/champion-builds/${c.alias}.json`,'utf8'),data,c.alias));
it('offers a legal ranked-safe version for non-proven builds that keeps the idea items and raises the grade',()=>{
 let offered=0,raised=0;
 for(const b of all){
  const before=buildProof(data,b.champion,b.itemIds,b.runePage)!,v=rankedSafeVariant(data,b.champion,b.itemIds,b.runePage,b.shards);
  if(before.level==='proven'){expect(v,b.id).toBeUndefined();continue}
  if(!v)continue;offered++;
  expect(legalBuild(v.itemIds.map(item),100000,6,b.champion),b.id).toBe(true);
  expect(v.itemIds).toHaveLength(b.itemIds.length);
  const own=(timing as {champions:Record<string,Record<string,{matches:number}>>}).champions[b.champion];
  const unseen=b.itemIds.filter(id=>!item(id).tags.includes('Boots')&&(own[id]?.matches||0)<500);
  for(const id of unseen.slice(0,2))expect(v.itemIds,b.id).toContain(id);
  for(const w of v.swaps){expect(b.itemIds).toContain(w.from);expect(v.itemIds).toContain(w.to)}
  if(v.runesChanged)expect(v.proof.keystone,b.id).toBe(true);
  const rank={experimental:0,adapted:1,proven:2};if(rank[v.proof.level]>rank[before.level])raised++;
  expect(rank[v.proof.level],b.id).toBeGreaterThanOrEqual(rank[before.level]);
 }
 expect(offered).toBeGreaterThan(400);expect(raised).toBeGreaterThan(350);
});
