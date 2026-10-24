import {it,expect} from 'vitest';
import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import timing from '../public/data/item-timing.json';
import type {Catalog} from '../src/types';
import {parseChampionBuilds} from '../src/chat-builds';
import {planFromChatBuild} from '../src/build-plan';
const data={...(catalog as unknown as Catalog),itemTiming:timing as never};
const generated=JSON.parse(fs.readFileSync('scripts/ranked-references.json','utf8'));
const builds=(alias:string)=>parseChampionBuilds(fs.readFileSync(`public/data/champion-builds/${alias}.json`,'utf8'),data,alias);
it('leads every champion with a Reference build taken from ranked data',()=>{
 expect(generated.patch).toBe(data.patch);
 for(const c of data.champions){
  const [first]=builds(c.alias),ranked=generated.references[c.alias];
  expect(first.category,c.alias).toBe('Reference');expect(first.ranked,c.alias).toBeDefined();
  expect(first.itemIds).toEqual(ranked.itemIds);expect(first.runePage).toEqual(ranked.runePage);
  for(const id of first.ranked!.observedCoreItemIds)expect(first.itemIds,c.alias).toContain(id);
  expect(first.ranked!.games,c.alias).toBeGreaterThan(0);expect(first.goal).toMatch(/ranked Emerald\+/);
 }
});
it('takes the core, keystone and role from the provider record it cites',()=>{
 const index=JSON.parse(fs.readFileSync('public/data/provider-research/index.json','utf8'));
 const dir=fs.existsSync(`public/data/provider-research/versions/a8d1ce99-678d-41ac-8af2-c8618da2b52c`)?'versions/a8d1ce99-678d-41ac-8af2-c8618da2b52c':index.recordsDirectory;
 for(const alias of ['Ahri','Caitlyn','Thresh','Chogath']){
  const [first]=builds(alias),source=JSON.parse(fs.readFileSync(`public/data/provider-research/${dir}/${alias}.json`,'utf8')).sources.find((s:{provider:string;role:string})=>s.provider===first.ranked!.provider&&s.role===first.ranked!.role);
  expect(first.ranked!.observedCoreItemIds.every((id:number)=>source.observedCoreItemIds.includes(id)),alias).toBe(true);
  expect(first.runePage[0],alias).toBe(source.observedRunePage[0]);
 }
});
it('plans Reference builds for their ranked role with a real start, recall menu and source',()=>{
 for(const c of data.champions){
  const plan=planFromChatBuild(data,builds(c.alias)[0],'authored');
  expect(plan.role,c.alias).not.toBe('unspecified');
  expect(plan.stages.find(s=>s.id==='start')!.available,c.alias).toBe(true);
  expect(plan.provenance.items).toBe('source-observed');expect(plan.sourceURL).toBeTruthy();expect(plan.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
 }
 const thresh=planFromChatBuild(data,builds('Thresh')[0],'authored');expect(thresh.role).toBe('support');expect(thresh.stages[0].buy).toContain(3865);
 const diana=planFromChatBuild(data,builds('Diana')[0],'authored');expect(diana.stages[0].chooseOne).toEqual([1101,1102,1103]);
});
it('binds other builds to the champion’s main ranked role when timing data is loaded',()=>{
 const other=builds('Ahri').find(b=>!b.ranked)!;
 expect(planFromChatBuild(data,other,'authored').role).toBe('mid');
 expect(planFromChatBuild(catalog as unknown as Catalog,other,'authored').role).toBe('unspecified');
});
