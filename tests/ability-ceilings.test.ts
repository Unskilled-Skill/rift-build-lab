import {it,expect} from 'vitest';
import fs from 'node:fs';
import additional from '../scripts/ability-ceilings/group-4.json';
import {parseChatBuilds,toTestSave} from '../src/chat-builds';
import type {Catalog} from '../src/types';
import catalog from '../public/data/catalog.json';
import resources from '../scripts/champion-resources.json';
import {validateCeilings} from '../scripts/ability-ceilings.mjs';
const candidate={champion:'Blitzcrank',key:'e-punch',name:'E punch',targetSlot:'E',targetName:'Power Fist',metric:'single-hit',damageType:'physical',objective:'One E hit',mechanic:'AD attack',itemIds:[3031,3508,6676,3036,3072,3142],pageKey:'ceilingAD',finiteState:'Level18, rank5, game30min, armor100',test:'Isolate E from proc packets',limits:'No verified absolute maximum',tradeoff:'No boots',confidence:'plausible'};
it('requires exact roster coverage and rejects duplicate target identifiers',()=>{expect(()=>validateCeilings([candidate],catalog,resources)).toThrow(/roster/);expect(()=>validateCeilings([candidate,candidate],catalog,resources,false)).toThrow(/duplicate/i)});
it('rejects unspecified benchmark text and invalid damage metrics',()=>{expect(()=>validateCeilings([{...candidate,finiteState:''}],catalog,resources,false)).toThrow(/finiteState/);expect(()=>validateCeilings([{...candidate,metric:'maximum'}],catalog,resources,false)).toThrow(/metric/)});
it('rejects impossible item-family and resource combinations before publishing a ceiling',()=>{expect(()=>validateCeilings([{...candidate,itemIds:[3031,3508,3078,3036,3072,3142]}],catalog,resources,false)).toThrow(/family/);expect(()=>validateCeilings([{...candidate,champion:'Akali',itemIds:[3042,3115,3089,3135,3157,3020]}],catalog,resources,false)).toThrow(/mana/);expect(validateCeilings([candidate],catalog,resources,false)).toHaveLength(1)});

it('publishes additional targets without dropping original targets or finite benchmark overrides',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(additional,catalog,resources,false)).toHaveLength(12);
 for(const e of additional){
  const builds=parseChatBuilds(fs.readFileSync(`public/data/ability-ceilings/${e.champion}.json`,'utf8'),data);
  expect(builds.length).toBeGreaterThan(1);
  const build=builds.find(b=>b.id===`${e.champion.toLowerCase()}-ceiling-${e.key}`)!;
  expect(build).toBeDefined();
  const setup=toTestSave(build,data);
  expect(setup.scenario).toMatchObject({...e.conditions,objectiveSlot:e.targetSlot,rank:e.champion==='Udyr'?6:5});
  expect(setup.requiresManualTest).toBe(true);
 }
 const index=JSON.parse(fs.readFileSync('public/data/ability-ceilings/index.json','utf8'));
 expect(index.targetCount).toBe(index.champions.reduce((n:number,c:{count:number})=>n+c.count,0));
 expect(index.targetCount).toBe(185);
});
it('rejects benchmark overrides that could change champion identity, add free stats or create impossible health',()=>{
 for(const conditions of [{champion:'Sett'},{extraAD:10000},{toString:1},{healthPercent:-10},{gatheringMinutes:Infinity},{critMode:'always'},{duration:0},[]])
  expect(()=>validateCeilings([{...candidate,conditions}],catalog,resources,false)).toThrow(/condition|crit/i);
});
