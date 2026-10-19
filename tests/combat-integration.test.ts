import {it,expect} from 'vitest';
import catalog from '../public/data/catalog.json';
import {calculate} from '../src/engine';
import {defaultScenario} from '../src/scenario';
import {objectiveOptions,modeledChampions} from '../src/model-support';
import {championResource} from '../src/resources';
import {parseCombatEffects} from '../src/combat-effects';
import {parseSave} from '../src/storage';
import {comparisonScenario} from '../src/workspace-draft';
import {compareAtTarget} from '../src/comparison-lab';
import type {Catalog,Scenario} from '../src/types';
const data=catalog as unknown as Catalog;
const champion=(alias:string)=>data.champions.find(c=>c.alias===alias)!;
const items=(ids:number[])=>ids.map(id=>data.items.find(i=>i.id===id)!);
const setup=(alias:string,extra:Partial<Scenario>={}):Scenario=>({...defaultScenario(alias),mode:objectiveOptions(alias)[0].mode,mr:0,armor:0,targetHP:20000,mana:100000,runePage:[],shards:[5007,5010,5013],...extra});

it('runs the shared effects pipeline for every existing damage objective across the exact champion roster',()=>{
 expect(new Set(modeledChampions).size).toBe(data.champions.length);
 let count=0;
 for(const c of data.champions)for(const objective of objectiveOptions(c.alias)){
  const s=setup(c.alias,{mode:objective.mode,rank:1,abilityStacks:1,gatheringMinutes:30,combatSeconds:5,
   runePage:[8229,championResource(c.alias).kind==='mana'?8226:8275,8233,8236,9103,8017],
   effects:{bloodlineStacks:15,manaflowStacks:10,runeProcsReady:true,itemProcsReady:true,hubrisKills:10,hubrisActive:true,jakshoActive:true}});
  const r=calculate(c,items([4633,2501,3053,6697,6665,3083]),s);
  expect(Number.isFinite(r.damage)&&r.damage>=0,`${c.alias}/${objective.mode}`).toBe(true);
  expect(r.nativeDamage!+r.procDamage!).toBeCloseTo(r.damage);
  expect(r.events.every(e=>Number.isFinite(e.damage)&&e.damage>=0)).toBe(true);
  expect(r.effectCoverage!.implemented).toContain('Absolute Focus');
  expect(r.stats.hp).toBeGreaterThan(0);count++;
 }
 expect(count).toBeGreaterThan(400);
});

it('feeds earned Bloodline and Manaflow through actual HP/mana-to-AP conversions once',()=>{
 const c=champion('Cassiopeia'),loadout=items([4633,3089,3040]);
 const s=setup(c.alias,{runePage:[9103,8226]});
 const base=calculate(c,loadout,s);
 const hp=calculate(c,loadout,{...s,effects:{bloodlineStacks:15}});
 expect(hp.stats.ap-base.stats.ap).toBeCloseTo(85*.02*1.3);
 const mana=calculate(c,loadout,{...s,effects:{manaflowStacks:10}});
 expect(mana.stats.ap-base.stats.ap).toBeCloseTo(250*.02*1.3);
 expect(mana.stats.mana-base.stats.mana).toBe(250);
});

it('separates native and proc damage without recursively proccing First Strike',()=>{
 const s=setup('Cassiopeia',{mode:'q',runePage:[8369],duration:3,firstStrikeReady:true});
 const r=calculate(champion(s.champion),[],s);
 expect(r.procDamage).toBeCloseTo(r.nativeDamage!*.07);
 expect(r.damage).toBeCloseTo(r.nativeDamage!*1.07);
 expect(r.events.filter(e=>e.origin==='native')).toHaveLength(1);
});

it('distinguishes a spell with on-hit delivery from a passive bonus packet',()=>{
 const s=setup('Ezreal',{mode:'cast-q',spellbladeReady:true,effects:{itemProcsReady:true}});
 const r=calculate(champion('Ezreal'),items([3115,3100]),s);
 expect(r.events.some(e=>e.name.includes('Icathian Bite'))).toBe(true);
 expect(r.events.filter(e=>e.name.includes('Lich Bane'))).toHaveLength(1);
 const tahm=calculate(champion('TahmKench'),items([3115,3100]),setup('TahmKench',{mode:'tahm-q',spellbladeReady:true,effects:{itemProcsReady:true}}));
 expect(tahm.procDamage).toBe(0);
});

it('uses reduced source on-hit effectiveness for one Purge shot',()=>{
 const s=setup('Urgot',{mode:'cast-w',spellbladeReady:true,effects:{itemProcsReady:true}});
 const r=calculate(champion('Urgot'),items([3115,3078]),s);
 const nashor=r.events.find(e=>e.name.includes('Icathian Bite'))!;
 expect(nashor.raw).toBeCloseTo((15+.15*r.stats.ap)*.5);
 expect(r.events.find(e=>e.name.includes('Spellblade'))!.raw).toBeCloseTo(r.stats.baseAD);
 expect(r.events.filter(e=>e.origin==='native')).toHaveLength(1);
});

it('can stop finite target scoring without claiming later damage after death',()=>{
 const s=setup('Cassiopeia',{mode:'q',targetHP:10,duration:3,effects:{stopAtDeath:true}});
 const finite=calculate(champion('Cassiopeia'),[],s);
 const potential=calculate(champion('Cassiopeia'),[],{...s,effects:{}});
 expect(finite.effectiveDamage).toBe(10);
 expect(finite.damage).toBeLessThan(potential.damage);
});

it('preserves validated preparation through saves and keeps baseline preparation independent',()=>{
 const s=setup('Cassiopeia',{runePage:[8229,8226,8233,8236,9103,8017],effects:{bloodlineStacks:15,manaflowStacks:10,cometDistance:500,runeProcsReady:true}});
 const save=parseSave(JSON.stringify({version:1,patch:'26.20',scenario:s,items:[]}),data.champions,data.items);
 expect(save.scenario.effects).toEqual(s.effects);
 const base=comparisonScenario(s,{ids:[],names:[],runePage:s.runePage,effects:{bloodlineStacks:0}});
 expect(base.effects).toEqual({bloodlineStacks:0});
 const pair=compareAtTarget(champion(s.champion),items([4633]),items([4633]),s,base);
 expect(pair.experiment.stats.hp-pair.baseline.stats.hp).toBe(85);
 expect(()=>parseCombatEffects({bloodlineStacks:16})).toThrow();
 expect(()=>parseCombatEffects({runeProcsReady:'yes'})).toThrow();
 expect(()=>parseCombatEffects({arbitrary:true})).toThrow();
});
