import {it,expect} from 'vitest';
import fs from 'node:fs';
import additional from '../scripts/ability-ceilings/group-4.json';
import expansion from '../scripts/ability-ceilings/group-5.json';
import conversionTargets from '../scripts/ability-ceilings/group-6.json';
import packetTargets from '../scripts/ability-ceilings/group-7.json';
import executionTargets from '../scripts/ability-ceilings/group-8.json';
import hybridTargets from '../scripts/ability-ceilings/group-9.json';
import {execFileSync} from 'node:child_process';
import {parseChatBuilds,toTestSave} from '../src/chat-builds';
import type {Catalog} from '../src/types';
import catalog from '../public/data/catalog.json';
import resources from '../scripts/champion-resources.json';
import {validateCeilings} from '../scripts/ability-ceilings.mjs';
const candidate={champion:'Blitzcrank',key:'e-punch',name:'E punch',targetSlot:'E',targetName:'Power Fist',metric:'single-hit',damageType:'physical',objective:'One E hit',mechanic:'AD attack',itemIds:[3031,3508,6676,3036,3072,3142],pageKey:'ceilingAD',finiteState:'Level18, rank5, game30min, armor100',test:'Isolate E from proc packets',limits:'No verified absolute maximum',tradeoff:'No boots',confidence:'plausible'};
it('roundtrips hybrid and form-specific candidates without losing health, damage type or manual-test requirements',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(hybridTargets,data,resources,false)).toHaveLength(16);
 for(const entry of hybridTargets){
  const builds=parseChatBuilds(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'),data);
  const b=builds.find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  const saved=toTestSave(b,data);
  expect(saved.scenario).toMatchObject(entry.conditions);
  expect(saved.requiresManualTest).toBe(true);
  expect(b.ceiling).toMatchObject({metric:entry.metric,damageType:entry.damageType,verification:'candidate'});
  if(entry.champion==='Elise'){
   expect(saved.scenario).toMatchObject({objectiveSlot:'Q:0',rank:5});
   const published=JSON.parse(fs.readFileSync('public/data/ability-ceilings/Elise.json','utf8')).builds.find((v:{id:string})=>v.id===b.id) as {kitEvidence:{formula:string}[]};
   expect(published.kitEvidence.some(e=>e.formula.includes('Human Form:'))).toBe(true);
  }
  if(entry.champion==='Gnar')expect(saved.scenario).toMatchObject({objectiveSlot:'W:0',rank:5});
 }
 const read=(c:string)=>hybridTargets.find(e=>e.champion===c)!;
 expect(read('Nautilus')).toMatchObject({metric:'shield',damageType:'none',pageKey:'ceilingHeal',conditions:{healthPercent:30,heartsteelHP:500,duration:6}});
 expect(read('Sejuani')).toMatchObject({damageType:'physical',conditions:{heartsteelHP:500,duration:2}});
 expect(read('Tryndamere').conditions).toMatchObject({healthPercent:30,conquerorStacks:12});
 for(const c of ['Vi','XinZhao','Tryndamere'])expect(read(c).damageType).toBe('physical');
});
it('preserves execution experiments as manual candidates with finite target health and no borrowed spell totals',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(executionTargets,data,resources,false)).toHaveLength(16);
 for(const entry of executionTargets){
  const builds=parseChatBuilds(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'),data);
  const b=builds.find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  const saved=toTestSave(b,data);
  expect(saved.requiresManualTest).toBe(true);
  expect(saved.scenario).toMatchObject({...entry.conditions,objectiveSlot:entry.targetSlot});
  expect(b.ceiling).toMatchObject({metric:entry.metric,damageType:entry.damageType,verification:'candidate'});
 }
 const read=(c:string)=>executionTargets.find(e=>e.champion===c)!;
 expect(read('Belveth').conditions).toMatchObject({targetHP:20000,targetHealthPercent:20,duration:1.5});
 expect(read('Jhin').conditions).toMatchObject({targetHP:10000,targetHealthPercent:10,critMode:'critical'});
 expect(read('Darius').conditions).toMatchObject({healthPercent:30,conquerorStacks:12});
 expect(read('Ambessa')).toMatchObject({metric:'shield',damageType:'none',pageKey:'ceilingHeal'});
 expect(read('Pantheon').damageType).toBe('physical');
 expect(read('Kaisa').conditions.duration).toBe(2);
});
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
 expect(index.targetCount).toBe(fs.readdirSync('scripts/ability-ceilings').filter(f=>/^group-\d+\.json$/.test(f)).reduce((n,f)=>n+JSON.parse(fs.readFileSync(`scripts/ability-ceilings/${f}`,'utf8')).length,0));
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
 const review=JSON.parse(fs.readFileSync('docs/ability-ceiling-review.json','utf8'));
 const authored=fs.readdirSync('scripts/ability-ceilings').filter(f=>/^group-\d+\.json$/.test(f)).flatMap(f=>JSON.parse(fs.readFileSync(`scripts/ability-ceilings/${f}`,'utf8')));
 expect(output).toContain(`Reviewed ${authored.length} ceiling targets`);
 expect(review.targetCount).toBe(authored.length);
 expect(new Set(review.targets.map((r:{champion:string})=>r.champion)).size).toBe(catalog.champions.length);
});

it('publishes conversion targets with finite conditions and distinct damage, shield, heal and stat metrics',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(conversionTargets,data,resources,false)).toHaveLength(15);
 for(const entry of conversionTargets){
  const builds=parseChatBuilds(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'),data);
  const b=builds.find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  expect(toTestSave(b,data).scenario).toMatchObject(entry.conditions);
  expect(b.ceiling).toMatchObject({metric:entry.metric,damageType:entry.damageType,verification:'candidate'});
  expect(b.requiresManualTest).toBe(true);
 }
 expect(conversionTargets.find(e=>e.champion==='Taric')!.conditions).toMatchObject({targetHP:6000,targetHealthPercent:30});
 const rammus=conversionTargets.find(e=>e.champion==='Rammus')!;
 expect(rammus.metric).toBe('stat');expect(rammus.damageType).toBe('none');
 const volley=conversionTargets.find(e=>e.champion==='Warwick')!;
 expect(volley.metric).toBe('full-window');expect(volley.conditions.duration).toBe(1.5);
});

it('publishes packet-focused targets with reproducible windows and separate critical delivery settings',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(packetTargets,data,resources,false)).toHaveLength(16);
 for(const entry of packetTargets){
  const builds=parseChatBuilds(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'),data);
  const b=builds.find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  const setup=toTestSave(b,data);
  expect(setup.requiresManualTest).toBe(true);
  expect(setup.scenario).toMatchObject(entry.conditions);
  expect(setup.scenario.objectiveSlot).toBe(entry.targetSlot);
 }
 expect(packetTargets.find(e=>e.champion==='Zoe')!.conditions).toMatchObject({targetHP:10000,duration:4});
 expect(packetTargets.find(e=>e.champion==='Anivia')!.conditions.duration).toBe(4);
 expect(packetTargets.find(e=>e.champion==='Nasus')!.conditions.duration).toBe(5);
 for(const champion of ['Caitlyn','Draven','Gangplank','MissFortune'])expect(packetTargets.find(e=>e.champion===champion)!.conditions.critMode).toBe('critical');
});
