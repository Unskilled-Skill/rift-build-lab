import {it,expect} from 'vitest';
import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import timing from '../public/data/item-timing.json';
import type {Catalog} from '../src/types';
import {parseChampionBuilds} from '../src/chat-builds';
import {planFromChatBuild} from '../src/build-plan';
import {parseMetaPlans} from '../src/meta-recommendations';
import {legalBuild} from '../src/build-rules';
import {adaptPlanToComp} from '../src/build-matchup';
const data={...(catalog as unknown as Catalog),itemTiming:timing as never};
const plans=parseMetaPlans(JSON.parse(fs.readFileSync('public/data/champion-meta-plans.json','utf8')),data);
const builds=(a:string)=>parseChampionBuilds(fs.readFileSync(`public/data/champion-builds/${a}.json`,'utf8'),data,a);
const item=(id:number)=>data.items.find(i=>i.id===id)!;
const comp={allies:[],enemies:['Soraka','Malphite','Zed','Vladimir','Jinx']};
it('adapts any six-item build to the enemy team while keeping its first core item and ranked core',()=>{
 for(const alias of ['Ahri','Caitlyn','Chogath','Thresh']){for(const b of builds(alias)){
  const plan=planFromChatBuild(data,b,'authored');if(plan.finalItemIds.length!==6)continue;
  const advice=adaptPlanToComp(data,plan,plans,comp,b.ranked?.observedCoreItemIds||[]);
  expect(advice.itemIds).toHaveLength(6);expect(legalBuild(advice.itemIds.map(item),100000,6,alias),b.id).toBe(true);
  expect(advice.itemIds).toContain(plan.stages.find(s=>s.id==='first-core')!.buy[0]);
  for(const id of b.ranked?.observedCoreItemIds||[])expect(advice.itemIds,b.id).toContain(id);
  for(const c of advice.changes){expect(plan.finalItemIds).toContain(c.removed);expect(advice.itemIds).toContain(c.added)}
 }}
});
it('answers heavy healing with anti-heal on a damage build',()=>{
 const plan=planFromChatBuild(data,builds('Ahri')[0],'authored');
 const advice=adaptPlanToComp(data,plan,plans,comp,builds('Ahri')[0].ranked!.observedCoreItemIds);
 expect(advice.itemIds).toContain(3165);expect(advice.priorities.map(p=>p.title)).toContain('Cover enemy healing');
});
it('refuses builds that are not six items',()=>{
 const plan=planFromChatBuild(data,builds('Ahri')[0],'authored');
 expect(()=>adaptPlanToComp(data,{...plan,finalItemIds:plan.finalItemIds.slice(0,5)},plans,comp)).toThrow(/six-item/);
});
