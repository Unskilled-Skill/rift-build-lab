import {it,expect} from 'vitest';
import fs from 'node:fs';
import additional from '../scripts/ability-ceilings/group-4.json';
import expansion from '../scripts/ability-ceilings/group-5.json';
import conversionTargets from '../scripts/ability-ceilings/group-6.json';
import packetTargets from '../scripts/ability-ceilings/group-7.json';
import executionTargets from '../scripts/ability-ceilings/group-8.json';
import hybridTargets from '../scripts/ability-ceilings/group-9.json';
import durationTargets from '../scripts/ability-ceilings/group-10.json';
import interactionTargets from '../scripts/ability-ceilings/group-11.json';
import sequenceTargets from '../scripts/ability-ceilings/group-12.json';
import repeatTargets from '../scripts/ability-ceilings/group-13.json';
import weaponTargets from '../scripts/ability-ceilings/group-14.json';
import potentialTargets from '../scripts/ability-ceilings/group-15.json';
import scalingTargets from '../scripts/ability-ceilings/group-16.json';
import conversionWindows from '../scripts/ability-ceilings/group-17.json';
import conditionalTargets from '../scripts/ability-ceilings/group-18.json';
import preparationTargets from '../scripts/ability-ceilings/group-19.json';
import extendedTargets from '../scripts/ability-ceilings/group-20.json';
import supportProcTargets from '../scripts/ability-ceilings/group-21.json';
import {execFileSync} from 'node:child_process';
import {parseChatBuilds,toTestSave} from '../src/chat-builds';
import type {Catalog} from '../src/types';
import catalog from '../public/data/catalog.json';
import resources from '../scripts/champion-resources.json';
import {validateCeilings,ceilingBuild} from '../scripts/ability-ceilings.mjs';
const candidate={champion:'Blitzcrank',key:'e-punch',name:'E punch',targetSlot:'E',targetName:'Power Fist',metric:'single-hit',damageType:'physical',objective:'One E hit',mechanic:'AD attack',itemIds:[3031,3508,6676,3036,3072,3142],pageKey:'ceilingAD',finiteState:'Level18, rank5, game30min, armor100',test:'Isolate E from proc packets',limits:'No verified absolute maximum',tradeoff:'No boots',confidence:'plausible'};
it('loads ally-proc, capped-shield and alternate-form experiments with their original evidence and conditions',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(supportProcTargets,data,resources,false)).toHaveLength(16);
 for(const entry of supportProcTargets){
  const published=JSON.parse(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'));
  const b=parseChatBuilds(JSON.stringify(published),data).find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  const saved=toTestSave(b,data);
  expect(saved.scenario).toMatchObject(entry.conditions);
  expect(saved.requiresManualTest).toBe(true);
  expect(b.ceiling).toMatchObject({metric:entry.metric,damageType:entry.damageType,verification:'candidate'});
  if(entry.champion==='RekSai')expect(saved.scenario).toMatchObject({objectiveSlot:'Q:1',rank:5});
  if(entry.champion==='Yuumi')expect(saved.scenario).toMatchObject({objectiveSlot:'Q',rank:6,duration:5,targetHP:20000});
  if(entry.evidenceSpell){
   const raw=published.builds.find((v:{id:string})=>v.id===b.id) as {kitEvidence:{ability:string;source:string;formula:string}[]};
   const kit=JSON.parse(fs.readFileSync(`public/data/champions/${entry.champion}.json`,'utf8'));
   const spell=kit.allSpellRecords.find((v:{internalName:string})=>v.internalName===entry.evidenceSpell);
   expect(raw.kitEvidence).toHaveLength(1);
   expect(raw.kitEvidence[0]).toMatchObject({ability:entry.targetName,source:spell.path});
   if(entry.champion==='RekSai')expect(raw.kitEvidence[0].formula).toContain(`BurrowDamageTooltip: ${spell.calculations.BurrowDamageTooltip.expression}`);
   if(entry.champion==='Karma')expect(raw.kitEvidence[0].formula).toContain(`REBonusShield: ${spell.calculations.REBonusShield.expression}`);
  }
 }
 const read=(c:string)=>supportProcTargets.find(e=>e.champion===c)!;
 for(const c of ['Olaf','Shyvana'])expect(read(c)).toMatchObject({metric:'shield',damageType:'none',conditions:{healthPercent:30,heartsteelHP:500,duration:2.5}});
 expect(read('Karma')).toMatchObject({targetSlot:'R',metric:'shield',conditions:{rank:4}});
 expect(read('Belveth')).toMatchObject({metric:'single-hit',damageType:'true',conditions:{duration:10,targetHP:20000}});
 expect(read('Taric').conditions.combatSeconds).toBe(5);
 expect(read('Nocturne')).toMatchObject({targetSlot:'E',metric:'full-window',conditions:{duration:2}});
});
it('keeps selected passive records, transform ranks and earned storm durations when loading the new batch',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(extendedTargets,data,resources,false)).toHaveLength(16);
 for(const entry of extendedTargets){
  const published=JSON.parse(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'));
  const b=parseChatBuilds(JSON.stringify(published),data).find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  const saved=toTestSave(b,data);
  expect(saved.scenario).toMatchObject(entry.conditions);
  expect(saved.requiresManualTest).toBe(true);
  expect(b.ceiling).toMatchObject({metric:entry.metric,damageType:entry.damageType,verification:'candidate'});
  if(entry.champion==='Gnar')expect(saved.scenario).toMatchObject({objectiveSlot:'Q:1',rank:5});
  if(entry.champion==='Elise')expect(saved.scenario).toMatchObject({objectiveSlot:'R',rank:4,healthPercent:10,duration:4});
  if(entry.evidenceSpell){
   const raw=published.builds.find((v:{id:string})=>v.id===b.id) as {kitEvidence:{ability:string;source:string;formula:string}[]};
   const kit=JSON.parse(fs.readFileSync(`public/data/champions/${entry.champion}.json`,'utf8'));
   const spell=kit.allSpellRecords.find((v:{internalName:string})=>v.internalName===entry.evidenceSpell);
   expect(raw.kitEvidence).toHaveLength(1);
   expect(raw.kitEvidence[0]).toMatchObject({ability:entry.targetName,source:spell.path});
   if(entry.champion==='Akali')expect(raw.kitEvidence[0].formula).toContain(`Damage: ${spell.calculations.Damage.expression}`);
   if(entry.champion==='Elise')expect(raw.kitEvidence[0].formula).toContain(`PassiveTotalHealing: ${spell.calculations.PassiveTotalHealing.expression}`);
  }
 }
 const read=(c:string)=>extendedTargets.find(e=>e.champion===c)!;
 expect(read('Viktor')).toMatchObject({metric:'full-window',conditions:{targetHP:20000,duration:18.5}});
 expect(read('Galio')).toMatchObject({metric:'stat',damageType:'none',conditions:{heartsteelHP:500,combatSeconds:5,duration:4}});
 expect(read('Heimerdinger')).toMatchObject({targetSlot:'E',metric:'full-window',conditions:{duration:3}});
 expect(read('Volibear')).toMatchObject({targetSlot:'E',metric:'single-hit',damageType:'magic'});
 expect(read('Akshan')).toMatchObject({targetSlot:'P',damageType:'magic'});
});
it('loads reservoir, replacement-attack and stat-output candidates with the selected form evidence',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(preparationTargets,data,resources,false)).toHaveLength(16);
 for(const entry of preparationTargets){
  const published=JSON.parse(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'));
  const b=parseChatBuilds(JSON.stringify(published),data).find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  const saved=toTestSave(b,data);
  expect(saved.scenario).toMatchObject(entry.conditions);
  expect(saved.requiresManualTest).toBe(true);
  expect(b.ceiling).toMatchObject({metric:entry.metric,damageType:entry.damageType,verification:'candidate'});
  if(entry.champion==='Jayce'){
   expect(saved.scenario).toMatchObject({objectiveSlot:'W:1',rank:6,critMode:'critical',duration:3.6});
   const raw=published.builds.find((v:{id:string})=>v.id===b.id) as {kitEvidence:{ability:string;source:string;formula:string}[]};
   const kit=JSON.parse(fs.readFileSync('public/data/champions/Jayce.json','utf8'));
   const spell=kit.allSpellRecords.find((v:{internalName:string})=>v.internalName==='JayceHyperCharge');
   expect(raw.kitEvidence).toHaveLength(1);
   expect(raw.kitEvidence[0]).toMatchObject({ability:entry.targetName,source:spell.path});
   expect(raw.kitEvidence[0].formula).toContain(`ActualDamage: ${spell.calculations.ActualDamage.expression}`);
  }
 }
 const read=(c:string)=>preparationTargets.find(e=>e.champion===c)!;
 expect(read('TahmKench')).toMatchObject({metric:'shield',damageType:'none',conditions:{healthPercent:20,heartsteelHP:500,duration:2.5}});
 expect(read('Mordekaiser')).toMatchObject({metric:'shield',conditions:{healthPercent:30,heartsteelHP:500,duration:5}});
 expect(read('Lissandra')).toMatchObject({metric:'heal',conditions:{healthPercent:10,duration:2.5}});
 for(const c of ['Illaoi','Sona'])expect(read(c)).toMatchObject({metric:'stat',damageType:'none'});
 expect(read('Khazix')).toMatchObject({damageType:'magic',conditions:{conquerorStacks:12}});
 expect(read('Fiora').conditions.critMode).toBe('critical');
});
it('preserves low-health recovery, shield growth and guaranteed crit conditions in the new experiments',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(conditionalTargets,data,resources,false)).toHaveLength(16);
 for(const entry of conditionalTargets){
  const published=JSON.parse(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'));
  const b=parseChatBuilds(JSON.stringify(published),data).find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  const saved=toTestSave(b,data);
  expect(saved.scenario).toMatchObject(entry.conditions);
  expect(saved.requiresManualTest).toBe(true);
  expect(b.ceiling).toMatchObject({metric:entry.metric,damageType:entry.damageType,verification:'candidate'});
  if(entry.champion==='Urgot')expect(saved.scenario).toMatchObject({objectiveSlot:'E',rank:5,heartsteelHP:500,healthPercent:30,duration:4});
  if(entry.champion==='Samira')expect(saved.scenario).toMatchObject({objectiveSlot:'R',rank:3,critMode:'critical',targetHP:20000,duration:2});
  if(entry.champion==='Hwei'){
   const raw=published.builds.find((v:{id:string})=>v.id===b.id) as {kitEvidence:{ability:string;source:string;formula:string}[]};
   const kit=JSON.parse(fs.readFileSync('public/data/champions/Hwei.json','utf8'));
   const spell=kit.allSpellRecords.find((v:{internalName:string})=>v.internalName==='HweiWW');
   expect(raw.kitEvidence).toHaveLength(1);
   expect(raw.kitEvidence[0]).toMatchObject({ability:entry.targetName,source:spell.path});
   expect(raw.kitEvidence[0].formula).toContain(`ShieldAmount: ${spell.calculations.ShieldAmount.expression}`);
  }
 }
 const read=(c:string)=>conditionalTargets.find(e=>e.champion===c)!;
 expect(read('Warwick')).toMatchObject({metric:'heal',damageType:'none',conditions:{healthPercent:10}});
 expect(read('Trundle')).toMatchObject({targetSlot:'P',metric:'heal',conditions:{healthPercent:10,targetHP:10000}});
 expect(read('Jhin').conditions).toMatchObject({critMode:'critical',targetHealthPercent:50});
 expect(read('Zeri').conditions.critMode).toBe('critical');
 expect(read('DrMundo').conditions.combatSeconds).toBe(4);
 expect(read('Rumble').conditions.duration).toBe(2);
});
it('roundtrips pet, crit and missing-health experiments without dropping their distinct benchmark states',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(conversionWindows,data,resources,false)).toHaveLength(16);
 for(const entry of conversionWindows){
  const published=JSON.parse(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'));
  const b=parseChatBuilds(JSON.stringify(published),data).find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  const saved=toTestSave(b,data);
  expect(saved.scenario).toMatchObject(entry.conditions);
  expect(saved.requiresManualTest).toBe(true);
  expect(b.ceiling).toMatchObject({metric:entry.metric,damageType:entry.damageType,verification:'candidate'});
  if(entry.champion==='Graves')expect(saved.scenario).toMatchObject({objectiveSlot:'P',critMode:'critical',targetHP:10000});
  if(entry.champion==='Kaisa')expect(saved.scenario).toMatchObject({objectiveSlot:'P',targetHealthPercent:20,targetHP:20000});
  if(entry.champion==='Zac')expect(saved.scenario).toMatchObject({objectiveSlot:'Q',rank:5,heartsteelHP:500,combatSeconds:4,duration:2.5});
 }
 const read=(c:string)=>conversionWindows.find(e=>e.champion===c)!;
 expect(read('Jax')).toMatchObject({metric:'stat',damageType:'none',conditions:{duration:8,conquerorStacks:12}});
 expect(read('Maokai')).toMatchObject({metric:'heal',damageType:'none',conditions:{healthPercent:10}});
 expect(read('Gangplank')).toMatchObject({damageType:'true',conditions:{duration:2.5,healthPercent:30}});
 expect(read('Malzahar')).toMatchObject({targetSlot:'W',metric:'single-hit',damageType:'magic'});
 expect(read('Malzahar').itemIds).toContain(3072);
 expect(read('Brand').conditions).toMatchObject({targetHP:20000,duration:5});
});
it('loads alternate spell forms and mixed-stat shield candidates with their finite setup intact',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(scalingTargets,data,resources,false)).toHaveLength(16);
 for(const entry of scalingTargets){
  const published=JSON.parse(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'));
  const b=parseChatBuilds(JSON.stringify(published),data).find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  const saved=toTestSave(b,data);
  expect(saved.scenario).toMatchObject(entry.conditions);
  expect(saved.requiresManualTest).toBe(true);
  expect(b.ceiling).toMatchObject({metric:entry.metric,damageType:entry.damageType,verification:'candidate'});
  if(entry.champion==='Briar')expect(saved.scenario).toMatchObject({objectiveSlot:'W:1',rank:5,targetHealthPercent:20,targetHP:20000});
  if(entry.champion==='LeeSin')expect(saved.scenario).toMatchObject({objectiveSlot:'E:0',rank:5});
  if(entry.champion==='Udyr')expect(saved.scenario).toMatchObject({objectiveSlot:'W',rank:6,heartsteelHP:500,healthPercent:30});
 }
 const read=(c:string)=>scalingTargets.find(e=>e.champion===c)!;
 for(const c of ['Morgana','Rakan','Udyr'])expect(read(c)).toMatchObject({metric:'shield',damageType:'none'});
 expect(read('Aatrox')).toMatchObject({metric:'stat',damageType:'none',conditions:{conquerorStacks:12}});
 expect(read('Nunu').conditions.duration).toBe(3.5);
 expect(read('Sylas').damageType).toBe('magic');
});
it('keeps pet-health, CC-duration and timed spell variants distinct when loading the new candidates',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(potentialTargets,data,resources,false)).toHaveLength(16);
 for(const entry of potentialTargets){
  const published=JSON.parse(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'));
  const b=parseChatBuilds(JSON.stringify(published),data).find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  const saved=toTestSave(b,data);
  expect(saved.scenario).toMatchObject(entry.conditions);
  expect(saved.requiresManualTest).toBe(true);
  expect(b.ceiling).toMatchObject({metric:entry.metric,damageType:entry.damageType,verification:'candidate'});
  if(entry.champion==='Gnar')expect(saved.scenario).toMatchObject({objectiveSlot:'E:0',rank:5,heartsteelHP:500});
  if(entry.champion==='Hwei'){
   const raw=published.builds.find((v:{id:string})=>v.id===b.id) as {kitEvidence:{source:string;formula:string}[]};
   const kit=JSON.parse(fs.readFileSync('public/data/champions/Hwei.json','utf8'));
   const spell=kit.allSpellRecords.find((s:{internalName:string})=>s.internalName==='HweiQE');
   expect(raw.kitEvidence[0].source).toBe(spell.path);
   expect(raw.kitEvidence[0].formula).toContain(`DamagePerSecond: ${spell.calculations.DamagePerSecond.expression}`);
  }
 }
 const read=(c:string)=>potentialTargets.find(e=>e.champion===c)!;
 for(const c of ['Pyke','Yorick'])expect(read(c)).toMatchObject({metric:'stat',damageType:'none'});
 expect(read('Garen')).toMatchObject({metric:'shield',conditions:{duration:0.75,heartsteelHP:500}});
 expect(read('Vladimir')).toMatchObject({metric:'heal',conditions:{combatSeconds:0,healthPercent:10,duration:4}});
 expect(read('Braum').pageKey).toBe('lt');
 expect(read('Yorick').pageKey).toBe('grasp');
 expect(read('Zed').conditions).toMatchObject({targetHP:20000,duration:4});
});
it('preserves weapon and hybrid candidates with the selected calculation evidence instead of a generic wrapper',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(weaponTargets,data,resources,false)).toHaveLength(16);
 for(const entry of weaponTargets){
  const published=JSON.parse(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'));
  const b=parseChatBuilds(JSON.stringify(published),data).find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  const saved=toTestSave(b,data);
  expect(saved.scenario).toMatchObject(entry.conditions);
  expect(saved.requiresManualTest).toBe(true);
  expect(b.ceiling).toMatchObject({metric:entry.metric,damageType:entry.damageType,verification:'candidate'});
  if(entry.champion==='Aphelios'){
   expect(saved.scenario).toMatchObject({objectiveSlot:'Q',rank:1});
   const raw=published.builds.find((v:{id:string})=>v.id===b.id) as {kitEvidence:{ability:string;source:string;formula:string}[]};
   const kit=JSON.parse(fs.readFileSync('public/data/champions/Aphelios.json','utf8'));
   const spell=kit.allSpellRecords.find((s:{internalName:string})=>s.internalName==='ApheliosCalibrumQ');
   expect(raw.kitEvidence).toHaveLength(1);
   expect(raw.kitEvidence[0]).toMatchObject({ability:entry.targetName,source:spell.path});
   expect(raw.kitEvidence[0].formula).toContain(`SpellDamage: ${spell.calculations.SpellDamage.expression}`);
  }
 }
 const read=(c:string)=>weaponTargets.find(e=>e.champion===c)!;
 expect(read('Smolder')).toMatchObject({damageType:'mixed',conditions:{targetHP:10000,duration:3}});
 expect(read('Kindred').conditions).toMatchObject({targetHP:20000,duration:4});
 expect(read('Leona')).toMatchObject({metric:'stat',damageType:'none',conditions:{combatSeconds:5}});
 expect(read('Vex')).toMatchObject({metric:'shield',damageType:'none',conditions:{healthPercent:30,duration:2.5}});
 expect(read('Ashe').conditions.critMode).toBe('normal');
});
it('rejects malformed and unavailable evidence selectors instead of silently using unrelated source records',()=>{
 for(const evidenceSpell of ['',null,12,[],{},'../spell','x'.repeat(121)])
  expect(()=>validateCeilings([{...candidate,evidenceSpell}],catalog,resources,false)).toThrow(/evidence/i);
 const kit=JSON.parse(fs.readFileSync('public/data/champions/Blitzcrank.json','utf8'));
 for(const evidenceSpell of ['NotARealSpell','ApheliosCalibrumQ'])
  expect(()=>ceilingBuild({...candidate,evidenceSpell},kit,catalog,resources)).toThrow(/unknown evidence spell/i);
});
it('preserves repeated-hit candidates without confusing continuous crit scaling with critical outcomes',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(repeatTargets,data,resources,false)).toHaveLength(16);
 for(const entry of repeatTargets){
  const builds=parseChatBuilds(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'),data);
  const b=builds.find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  const saved=toTestSave(b,data);
  expect(saved.scenario).toMatchObject(entry.conditions);
  expect(saved.requiresManualTest).toBe(true);
  expect(b.ceiling).toMatchObject({metric:entry.metric,damageType:entry.damageType,verification:'candidate'});
  if(entry.champion==='Nidalee')expect(saved.scenario).toMatchObject({objectiveSlot:'E:0',rank:5,healthPercent:10});
 }
 const read=(c:string)=>repeatTargets.find(e=>e.champion===c)!;
 expect(read('Kled').conditions).toMatchObject({heartsteelHP:500,healthPercent:100,duration:4});
 expect(read('Viego').conditions.critMode).toBe('normal');
 expect(read('Sivir').conditions.critMode).toBe('critical');
 expect(read('Velkoz')).toMatchObject({damageType:'true',conditions:{rodStacks:10}});
 expect(read('Morgana').conditions).toMatchObject({targetHP:20000,targetHealthPercent:25,duration:5});
 expect(read('Lux')).toMatchObject({metric:'shield',damageType:'none',conditions:{duration:2.5}});
 expect(read('Zyra').conditions).toMatchObject({duration:4,targetHP:10000});
});
it('roundtrips charged, delayed and renewal ceilings with finite setup and correct source slot',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(sequenceTargets,data,resources,false)).toHaveLength(16);
 for(const entry of sequenceTargets){
  const builds=parseChatBuilds(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'),data);
  const b=builds.find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  const saved=toTestSave(b,data);
  expect(saved.scenario).toMatchObject(entry.conditions);
  expect(saved.requiresManualTest).toBe(true);
  expect(b.ceiling).toMatchObject({metric:entry.metric,damageType:entry.damageType,verification:'candidate'});
  if(entry.champion==='Karma'){
   expect(saved.scenario).toMatchObject({objectiveSlot:'R',rank:4,healthPercent:10,heartsteelHP:500});
   const published=JSON.parse(fs.readFileSync('public/data/ability-ceilings/Karma.json','utf8')).builds.find((v:{id:string})=>v.id===b.id) as {kitEvidence:{ability:string;formula:string}[]};
   expect(published.kitEvidence.some(e=>e.ability==='Mantra'&&e.formula.includes('missing Health'))).toBe(true);
  }
 }
 const read=(c:string)=>sequenceTargets.find(e=>e.champion===c)!;
 expect(read('Blitzcrank').conditions).toMatchObject({rodStacks:10,duration:3,targetHP:10000});
 expect(read('Zilean').conditions).toMatchObject({duration:4,targetHP:10000});
 expect(read('Seraphine')).toMatchObject({metric:'heal',damageType:'none',conditions:{healthPercent:10,heartsteelHP:500,duration:3}});
 expect(read('Senna')).toMatchObject({metric:'heal',conditions:{targetHP:6000,targetHealthPercent:30}});
 expect(read('Zeri')).toMatchObject({targetSlot:'P',damageType:'magic'});
});
it('imports interaction ceilings with hammer rank six and separate buff, shield and heal metrics',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(interactionTargets,data,resources,false)).toHaveLength(16);
 for(const entry of interactionTargets){
  const builds=parseChatBuilds(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'),data);
  const b=builds.find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  const saved=toTestSave(b,data);
  expect(saved.scenario).toMatchObject(entry.conditions);
  expect(saved.requiresManualTest).toBe(true);
  expect(b.ceiling).toMatchObject({metric:entry.metric,damageType:entry.damageType,verification:'candidate'});
  if(entry.champion==='Jayce')expect(saved.scenario).toMatchObject({objectiveSlot:'E:0',rank:6});
 }
 const read=(c:string)=>interactionTargets.find(e=>e.champion===c)!;
 expect(read('Janna')).toMatchObject({metric:'stat',damageType:'none',conditions:{rodStacks:10,duration:4}});
 expect(read('Yone')).toMatchObject({metric:'shield',damageType:'none',conditions:{heartsteelHP:500,healthPercent:30,duration:1.5}});
 expect(read('Swain')).toMatchObject({metric:'heal',damageType:'none',conditions:{heartsteelHP:500,healthPercent:10,duration:4}});
 expect(read('MasterYi').conditions).toMatchObject({duration:2,critMode:'critical'});
 expect(read('Samira').conditions.critMode).toBe('critical');
 expect(read('Malphite').damageType).toBe('physical');
});
it('preserves poison windows, recipient shield state and finite stack setup through test imports',()=>{
 const data=catalog as unknown as Catalog;
 expect(validateCeilings(durationTargets,data,resources,false)).toHaveLength(16);
 for(const entry of durationTargets){
  const builds=parseChatBuilds(fs.readFileSync(`public/data/ability-ceilings/${entry.champion}.json`,'utf8'),data);
  const b=builds.find(b=>b.id===`${entry.champion.toLowerCase()}-ceiling-${entry.key}`)!;
  expect(b).toBeDefined();
  const saved=toTestSave(b,data);
  expect(saved.scenario).toMatchObject(entry.conditions);
  expect(saved.requiresManualTest).toBe(true);
  expect(b.ceiling).toMatchObject({metric:entry.metric,damageType:entry.damageType,verification:'candidate'});
  if(entry.champion==='Elise')expect(saved.scenario).toMatchObject({objectiveSlot:'W:0',rank:5});
 }
 const read=(c:string)=>durationTargets.find(e=>e.champion===c)!;
 expect(read('Twitch')).toMatchObject({metric:'full-window',damageType:'true',conditions:{duration:6,rodStacks:10,targetHP:10000}});
 expect(read('Milio')).toMatchObject({metric:'shield',damageType:'none',pageKey:'ceilingHeal',conditions:{targetHealthPercent:30,duration:1.5}});
 expect(read('Yorick')).toMatchObject({metric:'heal',damageType:'none',conditions:{healthPercent:10,heartsteelHP:500}});
 expect(read('Rumble').conditions.duration).toBe(3);
 expect(read('Teemo').conditions.duration).toBe(4);
 expect(read('Khazix').metric).toBe('heal');
});
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
