import {it,expect} from 'vitest';
import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import resources from '../scripts/champion-resources.json';
import {validateCeilingRunePlan} from '../scripts/ceiling-rune-plans.mjs';
import {validateCeilings,ceilingBuild} from '../scripts/ability-ceilings.mjs';
import {parseChatBuilds,toTestSave} from '../src/chat-builds';
import type {Catalog} from '../src/types';

const entries=fs.readdirSync('scripts/ability-ceilings').filter(n=>/^group-\d+\.json$/.test(n))
 .flatMap(n=>JSON.parse(fs.readFileSync(`scripts/ability-ceilings/${n}`,'utf8')));
const data=catalog as unknown as Catalog;
const find=(champion:string,slot:string)=>entries.find(e=>e.champion===champion&&e.targetSlot===slot);

it('covers the exact roster with explicit legal per-ability plans and rejects a missing review',()=>{
 expect(entries).toHaveLength(476);
 expect(new Set(entries.map(e=>e.champion)).size).toBe(catalog.champions.length);
 expect(validateCeilings(entries,catalog,resources)).toHaveLength(entries.length);
 const incomplete=structuredClone(entries);delete incomplete[0].runePlan;
 expect(()=>validateCeilings(incomplete,catalog,resources)).toThrow(/explicit per-ability rune review/);
});

it('publishes every reviewed page, explanation and benchmark without falling back to legacy presets',()=>{
 for(const champion of catalog.champions){
  const path=`public/data/ability-ceilings/${champion.alias}.json`;
  expect(fs.statSync(path).size).toBeLessThan(500000);
  const builds=parseChatBuilds(fs.readFileSync(path,'utf8'),data);
  for(const e of entries.filter(e=>e.champion===champion.alias)){
   const b=builds.find(b=>b.id===`${e.champion.toLowerCase()}-ceiling-${e.key}`)!;
   expect(b,`${e.champion}/${e.key}`).toBeDefined();
   expect(b.runePage).toEqual(e.runePlan.runes);
   expect(b.shards).toEqual(e.runePlan.shards);
   const saved=toTestSave(b,data);
   expect(saved.scenario.runePage).toEqual(e.runePlan.runes);
   expect(saved.scenario.shards).toEqual(e.runePlan.shards);
   expect(saved.scenario).toMatchObject(e.conditions||{});
   expect(b.testPlan).toContain(`Rune preparation: ${e.runePlan.setup.join(' ')}`);
   expect(b.testPlan).toContain(`Rune comparison: ${e.runePlan.alternatives.join(' ')}`);
   expect(b.coverageNotes.join(' ')).toContain('not a complete numerical rune solver');
   expect(saved.requiresManualTest).toBe(true);
  }
 }
 const e=entries[0],kit=JSON.parse(fs.readFileSync(`public/data/champions/${e.champion}.json`,'utf8'));
 const explicit=ceilingBuild({...e,pageKey:'nonexistent'},kit,catalog,resources) as {runePage:number[]};
 expect(explicit.runePage).toEqual(e.runePlan.runes);
});

it('rejects broken identity, explanations, dates, rune rows and shard rows',()=>{
 const sample=find('Blitzcrank','E');
 for(const change of [
  (e:any)=>{e.runePlan.target='different ability';},
  (e:any)=>{e.runePlan.reviewedAt='2026-02-30';},
  (e:any)=>{e.runePlan.reason='';},
  (e:any)=>{e.runePlan.setup=[];},
  (e:any)=>{e.runePlan.runeReasons[0]='Wrong rune: does something';},
  (e:any)=>{e.runePlan.runes[5]=e.runePlan.runes[4];},
  (e:any)=>{e.runePlan.runes[1]=e.runePlan.runes[2];},
  (e:any)=>{e.runePlan.runes.splice(4,2,9103,9104);},
  (e:any)=>{e.runePlan.shards[1]=5005;}
 ]){
  const e=structuredClone(sample);change(e);
  expect(()=>validateCeilingRunePlan(e,catalog,resources)).toThrow();
 }
});

it('rejects inactive baseline stats and stacks belonging to an unselected rune',()=>{
 const focused=entries.find(e=>e.runePlan.runes.includes(8233));
 const low=structuredClone(focused);low.conditions={...low.conditions,healthPercent:30};
 expect(()=>validateCeilingRunePlan(low,catalog,resources)).toThrow(/Absolute Focus/);
 const last=structuredClone(entries.find(e=>e.runePlan.runes.includes(8299)));
 last.conditions.healthPercent=100;
 expect(()=>validateCeilingRunePlan(last,catalog,resources)).toThrow(/Last Stand/);
 const noConq=structuredClone(entries.find(e=>!e.runePlan.runes.includes(8010)));
 noConq.conditions={...noConq.conditions,conquerorStacks:12};
 expect(()=>validateCeilingRunePlan(noConq,catalog,resources)).toThrow(/Conqueror stacks/);
 const mana=structuredClone(entries.find(e=>e.runePlan.runes.includes(8226)));
 expect(()=>validateCeilingRunePlan(mana,catalog,{...resources,[mana.champion]:'Energy'})).toThrow(/Manaflow/);
});

it('distinguishes ultimate eligibility, fixed attack rates, health conversions and attack-speed conversions',()=>{
 expect(find('Udyr','R').runePlan.runes).not.toContain(8224);
 expect(find('Pyke','R').runePlan.runes).not.toContain(8224);
 for(const c of ['Soraka','Shen'])expect(find(c,'R').runePlan.runes).toContain(8224);
 expect(find('DrMundo','R').runePlan.runes).toContain(8224);
 const urgot=find('Urgot','W').runePlan;
 expect(urgot.shards[0]).toBe(5008);
 for(const id of [9923,8008,9104])expect(urgot.runes).not.toContain(id);
 const vayne=entries.find(e=>e.champion==='Vayne'&&e.targetSlot==='W'&&e.metric==='full-window').runePlan;
 expect(vayne.runes).toEqual(expect.arrayContaining([9923,9104]));
 expect(vayne.shards).toEqual([5005,5001,5001]);
 for(const e of entries.filter(e=>e.champion==='Jhin')){
  expect(e.runePlan.runes).toContain(9104);
  expect(e.runePlan.shards[0]).toBe(5005);
 }
 expect(find('Garen','E').runePlan.shards[0]).toBe(5008);
 expect(find('Pyke','R').runePlan.shards).toEqual([5008,5001,5001]);
 expect(find('Shen','R').runePlan.shards.slice(1)).toEqual([5001,5001]);
});

it('keeps the AP coefficient on native true damage instead of treating the packet as rune-invariant',()=>{
 const e=entries.find(e=>e.champion==='Velkoz'&&e.key==='passive-three-stack-true');
 const kit=JSON.parse(fs.readFileSync('public/data/champions/Velkoz.json','utf8'));
 const source=kit.allSpellRecords.find((s:{internalName:string})=>s.internalName==='VelkozPassive');
 expect(source.calculations.TotalDamage.expression).toContain('(0.6) × AP');
 expect(e.runePlan.runes).toEqual([8229,8226,8233,8236,8345,8316]);
 expect(e.runePlan.shards).toEqual([5008,5008,5001]);
 expect(e.runePlan.runeReasons.find((r:string)=>r.startsWith('Gathering Storm:'))).toContain('0.6 AP');
 expect(e.runePlan.exclusions.join(' ')).not.toContain('rune-invariant');
 expect(e.runePlan.alternatives.join(' ')).toContain('do not grant twelve free stacks');
 const build=ceilingBuild(e,kit,catalog,resources) as {kitEvidence:{formula:string}[]};
 expect(build.kitEvidence.some(s=>s.formula===source.tooltipWithSymbolicValues)).toBe(true);
});

it('uses direct adaptive scaling for hybrid AP/resistance hits while preserving health scaling on Galio W',()=>{
 const targets=[
  ['Taric','ability-ceiling-e'],
  ['Malphite','w-armor-first-hit'],
  ['Malphite','e-armor-ap-shield-state'],
  ['Malphite','e-armor-ap-hybrid'],
  ['Galio','r-bonus-mr-landing'],
  ['Galio','passive-ad-mr-crossover']
 ];
 for(const [champion,key] of targets){
  const e=entries.find(e=>e.champion===champion&&e.key===key);
  expect(e.runePlan.shards,`${champion}/${key}`).toEqual([5008,5008,5001]);
  expect(e.runePlan.shardReason).toMatch(/AP/);
 }
 const reduction=entries.find(e=>e.champion==='Galio'&&e.key==='w-ap-mr-hp-damage-reduction');
 expect(reduction.runePlan.shards).toEqual([5008,5001,5001]);
 expect(reduction.runePlan.shardReason).toContain('0.0004 AP');
 expect(reduction.runePlan.shardReason).toContain('0.0001 bonus-HP');
 // Armor-only and flat-percent packets must not inherit these AP shard choices.
 expect(find('Taric','P').runePlan.shards[0]).toBe(5007);
 expect(find('Rammus','W').runePlan.shards[0]).toBe(5007);
 expect(find('JarvanIV','P').runePlan.shards[0]).toBe(5007);
});

it('loads current Naafiri pursuit as rank-three R while W supplies packmate preparation',()=>{
 const e=entries.find(e=>e.champion==='Naafiri'&&e.key==='ability-ceiling-w');
 expect(e.targetSlot).toBe('R');
 expect(e.evidenceSpell).toBe('NaafiriW');
 expect(e.mechanic).toContain('dogs+W two');
 const kit=JSON.parse(fs.readFileSync('public/data/champions/Naafiri.json','utf8'));
 const build=ceilingBuild(e,kit,catalog,resources) as {conditions:{objectiveSlot:string;rank:number};kitEvidence:{source:string;formula:string}[];runePage:number[]};
 expect(build.conditions).toMatchObject({objectiveSlot:'R',rank:3});
 expect(build.runePage).toContain(8224);
 expect(build.kitEvidence).toHaveLength(1);
 expect(build.kitEvidence[0].source).toBe('Characters/Naafiri/Spells/NaafiriWAbility/NaafiriW');
 expect(build.kitEvidence[0].formula).toContain('PackmateDamage:');
 expect(()=>ceilingBuild({...e,targetSlot:'W'},kit,catalog,resources)).toThrow(/different ability slot/);
});

it('keeps native AP and HP scaling together in hybrid candidates instead of blindly choosing health-only pages',()=>{
 for(const [champion,key] of [
  ['Nunu','q-champion-ap-hp'],['Vladimir','e-max-charge-hp-ap'],
  ['Pantheon','w-health-ap-leap'],['Sejuani','w-hp-ap-two-hit']
 ]){
  const e=entries.find(e=>e.champion===champion&&e.key===key);
  expect(e.runePlan.runes,`${champion}/${key}`).toEqual(expect.arrayContaining([8233,8236,9103]));
  expect(e.runePlan.shards).toEqual([5008,5001,5001]);
  expect(e.runePlan.setup.join(' ')).toMatch(/15/);
  expect(e.runePlan.alternatives.join(' ')).toMatch(/Overgrowth/);
 }
});

it('removes attack speed from an AP-only fixed Katarina channel while retaining it for actual timed attacks',()=>{
 const kat=entries.find(e=>e.champion==='Katarina'&&e.key==='ability-ceiling-katarina-r');
 expect(kat.itemIds).toContain(4633);
 expect(kat.runePlan.runes).toContain(9103);
 expect(kat.runePlan.runes).not.toContain(9104);
 expect(kat.runePlan.shards).toEqual([5008,5008,5001]);
 expect(kat.runePlan.reason).toContain('zero term');
 const azir=find('Azir','W');
 expect(azir.runePlan.runes).toContain(9104);
 expect(azir.runePlan.shards[0]).toBe(5005);
 const braum=find('Braum','P');
 expect(braum.runePlan.runes).toEqual(expect.arrayContaining([8008,9104,8017]));
 expect(braum.runePlan.setup.join(' ')).toContain('six real Lethal Tempo stacks');
 const kindred=find('Kindred','W');
 const kindredKit=JSON.parse(fs.readFileSync('public/data/champions/Kindred.json','utf8'));
 const wolf=kindredKit.allSpellRecords.find((s:{internalName:string})=>s.internalName==='KindredW');
 expect(wolf.dataValuesRaw.LambToWolfAttackSpeedConversionPercent.every((v:number)=>v===0.25)).toBe(true);
 expect(kindred.runePlan.runes).toContain(9104);
 expect(kindred.runePlan.shards[0]).toBe(5005);
 expect(kindred.runePlan.reason).toContain('25% Lamb attack-speed conversion');
});

it('uses item stats that support the selected native heal, shield or stat objective without crediting ally procs',()=>{
 for(const [champion,key] of [['Trundle','p-single-death-healing'],['Thresh','w-five-hundred-soul-self-shield']]){
  const e=entries.find(e=>e.champion===champion&&e.key===key);
  expect(e.itemIds).toContain(6616);
  expect(e.itemIds).not.toContain(champion==='Trundle'?3089:6617);
 }
 for(const [champion,key] of [['Gwen','w-ap-granted-resistances'],['Sona','w-diminuendo-damage-reduction']]){
  const e=entries.find(e=>e.champion===champion&&e.key===key);
  expect(e.itemIds).toContain(3157);
  expect(e.itemIds).not.toContain(3135);
 }
 for(const [champion,key] of [['Nautilus','w-max-health-shield'],['Rell','w-health-shield'],['Garen','w-bonus-health-shield']]){
  const e=entries.find(e=>e.champion===champion&&e.key===key);
  expect(e.itemIds).toContain(6621);
  expect(e.itemIds).not.toContain(3181);
  expect(e.runePlan.alternatives.join(' ')).toContain('16% static shield power');
 }
 const garen=entries.find(e=>e.champion==='Garen'&&e.key==='w-bonus-health-shield');
 expect(garen.runePlan.exclusions.join(' ')).toContain('do not grant its regeneration-based extra power');
});
