import {it,expect} from 'vitest';
import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import timing from '../public/data/item-timing.json';
import type {Catalog} from '../src/types';
import {parseChatBuilds,parseChampionBuilds} from '../src/chat-builds';
import {planFromChatBuild} from '../src/build-plan';
import {observedOrder,purchaseTiming} from '../src/purchase-timing';
import {itemTiming} from '../scripts/prepare-item-timing.mjs';
const base=catalog as unknown as Catalog,data={...base,itemTiming:timing as never};
const order=(plan:ReturnType<typeof planFromChatBuild>)=>plan.stages.filter(s=>s.id==='first-core'||s.id==='later-core').flatMap(s=>s.buy);
function* allPlans(){
 for(const [dir,kind] of [['champion-builds','authored'],['ability-ceilings','ceiling']] as const)for(const f of fs.readdirSync(`public/data/${dir}`).filter(f=>f.endsWith('.json'))){
  const raw=fs.readFileSync(`public/data/${dir}/${f}`,'utf8');
  let builds;try{builds=kind==='authored'?parseChampionBuilds(raw,data,f.slice(0,-5)):parseChatBuilds(raw,data)}catch{continue}
  for(const b of builds)yield {b,plan:planFromChatBuild(data,b,kind)};
 }
}
it('derives typical buy slots from provider cores and slot options, weighted by matches',()=>{
 const t=itemTiming([{champion:'A',role:'mid',provider:'opgg',status:'available',observedCoreItemIds:[1,2,3],coreBuildMatches:100,observedItemOptions:[{slot:4,items:[{id:9,matches:300},{id:3,matches:100}]}]}],new Set([1,2,3,9]));
 expect(t.global[1].slot).toBe(1);expect(t.global[9].slot).toBe(4);expect(t.global[3].slot).toBeCloseTo((3*100+4*100)/200);expect(t.champions.A[2].slot).toBe(2);
});
it('reflects how ranked players actually buy multiplier and penetration items',()=>{
 for(const id of [3089,3135,3036,3026])expect(timing.global[id as unknown as keyof typeof timing.global].slot).toBeGreaterThan(3.5);
 expect(observedOrder(data,[3089,3135,6655])).toEqual([6655,3089,3135]);
});
it('never opens any build or ceiling with a late multiplier, penetration or safety item',()=>{
 let n=0;for(const {plan} of allPlans()){n++;const o=order(plan);expect([3089,3135,3036,3026],plan.id).not.toContain(o[0]);
  expect(o.length,plan.id).toBe(plan.finalItemIds.filter(id=>!data.items.find(i=>i.id===id)!.tags.includes('Boots')).length);
 }
 expect(n).toBeGreaterThan(1000);
});
it("orders Cho'Gath's Feast ceiling the way Cho'Gath players build and labels it a ceiling loadout",()=>{
 const b=parseChatBuilds(fs.readFileSync('public/data/ability-ceilings/Chogath.json','utf8'),data).find(b=>b.name==='Feast champion damage ceiling')!;
 const plan=planFromChatBuild(data,b,'ceiling'),o=order(plan);
 expect(o[0]).toBe(3084);expect(o.indexOf(3089)).toBeGreaterThan(2);
 expect(plan.stages.at(-1)!.title).toBe('Ceiling loadout');expect(plan.stages.at(-1)!.note).toMatch(/not part of the benchmark/);
 expect(plan.stages.find(s=>s.id==='later-core')!.note).toMatch(/Emerald\+/);expect(plan.provenance.order).toBe('inferred');
});
it('keeps the written order where no purchase data exists',()=>{
 expect(purchaseTiming(base,[3089,3135,6655,3157]).coreIds).toEqual([6655,3089,3135,3157]);
 expect(observedOrder(base,[3135,6655,3157])).toEqual([3135,6655,3157]);
});
