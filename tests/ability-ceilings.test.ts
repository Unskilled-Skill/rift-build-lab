import {it,expect} from 'vitest';
import fs from 'node:fs';
import additional from '../scripts/ability-ceilings/group-4.json';
import expansion from '../scripts/ability-ceilings/group-5.json';
import {execFileSync} from 'node:child_process';
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
 expect(index.targetCount).toBe(205);
});
it('rejects benchmark overrides that could change champion identity, add free stats or create impossible health',()=>{
 for(const conditions of [{champion:'Sett'},{extraAD:10000},{toString:1},{healthPercent:-10},{gatheringMinutes:Infinity},{critMode:'always'},{duration:0},{duration:0.1},{heartsteelHP:10001},{rodStacks:1.5},{rank:2.5},{objectiveSlot:'R'},[]])
  expect(()=>validateCeilings([{...candidate,conditions}],catalog,resources,false)).toThrow(/condition|crit/i);
});

it('loads every new target with the authored form and separates cougar scaling from human Q rank',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(expansion,data,resources,false)).toHaveLength(20);
 for(const e of expansion){
  const builds=parseChatBuilds(fs.readFileSync(`public/data/ability-ceilings/${e.champion}.json`,'utf8'),data);
  const b=builds.find(b=>b.id===`${e.champion.toLowerCase()}-ceiling-${e.key}`)!;
  expect(toTestSave(b,data).scenario).toMatchObject(e.conditions);
  expect(b.requiresManualTest).toBe(true);
 }
 const cougar=JSON.parse(fs.readFileSync('public/data/ability-ceilings/Nidalee.json','utf8')).builds.find((b:{id:string})=>b.id==='nidalee-ceiling-q-cougar-hunted');
 expect(cougar.conditions).toMatchObject({objectiveSlot:'Q:1',rank:4});
 expect(cougar.kitEvidence.some((e:{ability:string})=>e.ability.startsWith('Takedown'))).toBe(true);
 expect(cougar.kitEvidence.some((e:{ability:string})=>e.ability==='Javelin Toss / Takedown')).toBe(false);
});
it('retains reviewed legacy finite state rather than generic full-health zero-stack defaults',()=>{
 const data=catalog as unknown as Catalog;
 const read=(c:string)=>parseChatBuilds(fs.readFileSync(`public/data/ability-ceilings/${c}.json`,'utf8'),data)[0];
 expect(toTestSave(read('Braum'),data).scenario).toMatchObject({heartsteelHP:500,targetHealthPercent:35,gatheringMinutes:30});
 expect(toTestSave(read('Aatrox'),data).scenario).toMatchObject({healthPercent:30,combatSeconds:5,conquerorStacks:12});
 expect(read('Aatrox').runePage).toContain(8299);
 expect(read('Aatrox').runePage).not.toContain(8233);
 expect(toTestSave(read('Kassadin'),data).scenario).toMatchObject({rodStacks:10});
 expect(toTestSave(read('Tryndamere'),data).scenario).toMatchObject({healthPercent:10});
 expect(read('Tryndamere').runePage).toContain(8453);
 expect(toTestSave(read('Jayce'),data).scenario).toMatchObject({objectiveSlot:'Q:1',rank:6});
});
it('executes the full-library audit and checks publication parity for every authored target',()=>{
 const output=execFileSync(process.execPath,['scripts/audit-ability-ceilings.mjs'],{encoding:'utf8'});
 expect(output).toContain('Reviewed 205 ceiling targets');
 const review=JSON.parse(fs.readFileSync('docs/ability-ceiling-review.json','utf8'));
 const authored=fs.readdirSync('scripts/ability-ceilings').filter(f=>/^group-\d+\.json$/.test(f)).flatMap(f=>JSON.parse(fs.readFileSync(`scripts/ability-ceilings/${f}`,'utf8')));
 expect(review.targetCount).toBe(authored.length);
 expect(new Set(review.targets.map((r:{champion:string})=>r.champion)).size).toBe(catalog.champions.length);
});
