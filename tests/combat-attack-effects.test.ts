import {describe,it,expect} from 'vitest';
import {createProcEffects,type ProcHit} from '../src/combat-proc-effects';
import {defaultScenario} from '../src/scenario';
import {calculate} from '../src/engine';
import {objectiveOptions} from '../src/model-support';
import {parseCombatEffects} from '../src/combat-effects';
import {compareAtTarget} from '../src/comparison-lab';
import type {Champion,Item,Result,Scenario,Catalog} from '../src/types';
import catalog from '../public/data/catalog.json';
import evidence from '../scripts/combat-source-evidence.json';

const data=catalog as unknown as Catalog;
const champion={id:0,alias:'Test',name:'Test',title:'',roles:[],stats:{attackrange:175},profile:null} as Champion;
const stats:Result['stats']={ap:200,bonusAD:50,baseAD:100,ad:150,critChance:0,critDamage:2,bonusAS:.5,bonusMana:0,armor:0,bonusArmor:0,mr:0,bonusMR:0,hp:2000,bonusHP:1000,haste:0,mana:1000,flatPen:0,percentPen:0};
const items=(ids:number[])=>ids.map(id=>data.items.find(i=>i.id===id)!);
const s=(runePage:number[],extra:Partial<Scenario>={}):Scenario=>({...defaultScenario(),duration:60,level:18,runePage,effects:{runeProcsReady:true,itemProcsReady:true},...extra});
const hit=(extra:Partial<ProcHit>={}):ProcHit=>({castId:'q',time:0,type:'physical',raw:100,damage:100,kind:'ability',spellEffects:true,appliesOnHit:false,targetHealthPercent:100,...extra});
const attack=(extra:Partial<ProcHit>={})=>hit({kind:'attack',spellEffects:false,appliesOnHit:true,...extra});
const factory=(runes:number[],ids:number[]=[],extra:Partial<Scenario>={})=>createProcEffects(champion,items(ids),s(runes,extra),stats);
const names=(p:ReturnType<typeof factory>,h:ProcHit)=>p.onHit(h).map(p=>p.name);

describe('source-supported attack and distinct-action triggers',()=>{
 it('locks current coefficients to pinned rune and item records',()=>{
  const r=(id:number)=>data.runes.find(r=>r.id===id)!.effectValuesRaw as unknown as Record<string,number>;
  expect(r(8005)).toMatchObject({MinDamage:40,MaxDamage:160,HitsRequired:3,TimeBetweenHits:4,Cooldown:6});
  expect(r(8437).PercentHealthDamage).toBeCloseTo(.035);expect(r(8437).RangedPenaltyMod).toBeCloseTo(.4);
  expect(r(8112)).toMatchObject({DamageBase:70,DamageMax:240,Cooldown:20,WindowDuration:3});
  expect(r(8126)).toMatchObject({DamageIncMin:10,DamageIncMax:45,Cooldown:4});
  expect(r(8143)).toMatchObject({ArmedDuration:4,MinDamageTooltip:20,MaxDamageTooltip:80});
  expect(evidence.items['3153'].values.MeleeValue).toBeCloseTo(.09);expect(evidence.items['3153'].values.RangedValue).toBeCloseTo(.06);
  expect(evidence.items['3091'].calculations.OnHitDamage.mFormulaParts[0].mNumber).toBe(45);
  expect(evidence.items['3124'].values).toMatchObject({OnHitDamage:30,MaxStacks:4});
 });
 it('requires explicit readiness and never adds on-hits to ordinary spells',()=>{
  expect(names(factory([8437,8005,8112,8126,8143],[3153,3091,3124]),hit())).toEqual([]);
  expect(names(factory([8437,8005,8112,8126,8143],[3153,3091,3124],{effects:{graspReady:true,ptaHitsBefore:2,electrocuteHitsBefore:2,targetImpaired:true,suddenImpactArmed:true}}),attack())).toEqual([]);
 });
 it('requires charged Grasp, counts one delivery and keeps health growth outside damage',()=>{
  const p=factory([8437],[],{effects:{runeProcsReady:true,graspReady:true}});
  expect(p.onHit(hit())).toEqual([]);
  expect(p.onHit(attack())[0]).toMatchObject({name:'Grasp of the Undying',raw:70,type:'magic'});
  expect(p.onHit(attack({castId:'aa2',time:5}))).toEqual([]);
  const ranged=factory([8437],[],{effects:{runeProcsReady:true,graspReady:true,attackForm:'ranged'}});
  expect(ranged.onHit(attack())[0].raw).toBeCloseTo(28);
  const urgot=factory([8437],[],{effects:{runeProcsReady:true,graspReady:true,attackForm:'ranged'}});
  expect(urgot.onHit(attack({onHitMultiplier:.5}))[0].raw).toBeCloseTo(14);
 });
 it('counts PTA deliveries, expires preparation and respects cooldown',()=>{
  const p=factory([8005],[],{effects:{runeProcsReady:true,ptaHitsBefore:2}});
  expect(p.onHit(hit())).toEqual([]);
  expect(p.onHit(attack())[0]).toMatchObject({name:'Press the Attack',raw:160,activatesPTA:true,excludePTA:true});
  expect(p.onHit(attack({time:1}))).toEqual([]);expect(p.onHit(attack({time:2}))).toEqual([]);
  expect(factory([8005],[],{effects:{runeProcsReady:true,ptaHitsBefore:2}}).onHit(attack({time:4.01}))).toEqual([]);
  expect(factory([8005],[],{effects:{runeProcsReady:true,ptaHitsBefore:2,ptaActive:true}}).onHit(attack())).toEqual([]);
 });
 it('requires three distinct Electrocute actions rather than DOT ticks or split packets',()=>{
  const p=factory([8112]);
  for(const time of [0,.25,.5,1])expect(p.onHit(hit({time,periodic:true}))).toEqual([]);
  expect(p.onHit(hit({castId:'e1',time:1.25}))).toEqual([]);
  expect(p.onHit(hit({castId:'e2',time:1.5}))[0]).toMatchObject({name:'Electrocute',raw:255,type:'magic'});
  for(const [n,time] of [2,3,4].entries())expect(p.onHit(hit({castId:`later${n}`,time}))).toEqual([]);
  const prepared=factory([8112],[],{effects:{runeProcsReady:true,electrocuteHitsBefore:2}});
  expect(prepared.onHit(hit())[0].name).toBe('Electrocute');
  expect(factory([8112],[],{effects:{runeProcsReady:true,electrocuteHitsBefore:2}}).onHit(hit({time:3.01}))).toEqual([]);
 });
 it('requires explicit CC for Cheap Shot and enforces its real cooldown',()=>{
  expect(factory([8126]).onHit(hit())).toEqual([]);
  const p=factory([8126],[],{effects:{runeProcsReady:true,targetImpaired:true}});
  expect(p.onHit(hit())[0]).toMatchObject({name:'Cheap Shot',raw:45,type:'true'});
  expect(p.onHit(hit({time:3.99}))).toEqual([]);expect(p.onHit(hit({time:4}))[0].raw).toBe(45);
 });
 it('does not infer Sudden Impact from a dash name or rearm it after cooldown',()=>{
  expect(factory([8143]).onHit(hit())).toEqual([]);
  const p=factory([8143],[],{effects:{runeProcsReady:true,suddenImpactArmed:true}});
  expect(p.onHit(hit({time:3.99}))[0]).toMatchObject({name:'Sudden Impact',raw:80,type:'true'});
  expect(p.onHit(hit({time:20}))).toEqual([]);
  expect(factory([8143],[],{effects:{runeProcsReady:true,suddenImpactArmed:true}}).onHit(hit({time:4}))).toEqual([]);
 });
 it('adds current Wits/Rageblade damage only to eligible reduced/full deliveries',()=>{
  const p=factory([],[3091,3124]);
  expect(p.onHit(hit())).toEqual([]);
  expect(p.onHit(attack()).map(p=>p.raw)).toEqual([45,30]);
  expect(p.onHit(attack({onHitMultiplier:.5,time:1})).map(p=>p.raw)).toEqual([22.5,15]);
  expect(p.onHit(attack({appliesOnHit:false,time:2}))).toEqual([]);
 });
 it('uses live current HP in Bork packets and preserves ranged/reduced coefficients',()=>{
  expect(factory([],[3153]).onHit(attack({targetHealthPercent:50}))[0]).toMatchObject({currentHPRatio:.09,raw:112.5});
  expect(factory([],[3153],{effects:{itemProcsReady:true,attackForm:'ranged'}}).onHit(attack({onHitMultiplier:.5}))[0].currentHPRatio).toBeCloseTo(.03);
 });
 it('validates the new saved preparation counters and flags',()=>{
  expect(parseCombatEffects({ptaHitsBefore:2,electrocuteHitsBefore:2,ragebladeStacks:4,graspReady:true,targetImpaired:true,suddenImpactArmed:false})).toMatchObject({ptaHitsBefore:2});
  for(const e of [{ptaHitsBefore:3},{electrocuteHitsBefore:-1},{ragebladeStacks:5},{graspReady:1}])expect(()=>parseCombatEffects(e)).toThrow();
 });
});

describe('integrated causal ordering and champion delivery eligibility',()=>{
 const base=(alias:string,extra:Partial<Scenario>={}):Scenario=>({...defaultScenario(alias),armor:0,mr:0,targetHP:100000,mana:100000,runePage:[],shards:[5007,5010,5013],...extra});
 const c=(alias:string)=>data.champions.find(c=>c.alias===alias)!;
 it('counts Renekton W as three on-hits, one Electrocute action and one Hail attack',()=>{
  const setup=base('Renekton',{mode:'cast-w-empowered',effects:{itemProcsReady:true,runeProcsReady:true}});
  const result=calculate(c('Renekton'),items([3091]),{...setup,runePage:[8005,8112,9923]});
  expect(result.events.filter(e=>e.name==='Press the Attack')).toHaveLength(1);
  expect(result.events.filter(e=>e.name==='Electrocute')).toHaveLength(0);
  expect(result.events.filter(e=>e.name==='Hail of Blades')).toHaveLength(1);
  expect(result.events.filter(e=>e.name==='Wit’s End Fray')).toHaveLength(3);
  expect(result.events.filter(e=>e.origin==='native').map(e=>e.damage)).toEqual(calculate(c('Renekton'),items([3091]),setup).events.filter(e=>e.origin==='native').map(e=>e.damage));
 });
 it('samples Bork after each native hit instead of granting three full-health procs',()=>{
  const result=calculate(c('Renekton'),items([3153]),base('Renekton',{mode:'cast-w-empowered',targetHP:10000,effects:{itemProcsReady:true}}));
  let hp=10000;
  for(const event of result.events){if(event.name.includes('Mist’s Edge'))expect(event.raw).toBeCloseTo(hp*.09);hp=Math.max(0,hp-event.damage);}
  expect(result.events.filter(e=>e.name.includes('Mist’s Edge'))).toHaveLength(3);
 });
 it('activates PTA after the burst without amplifying the third native hit or itself',()=>{
  const setup=base('Renekton',{mode:'cast-w-empowered',runePage:[8005],effects:{runeProcsReady:true,itemProcsReady:true}});
  const result=calculate(c('Renekton'),items([3091]),setup);
  expect(result.events.find(e=>e.name==='Press the Attack')!.damage).toBe(160);
  const fray=result.events.filter(e=>e.name==='Wit’s End Fray');
  expect(fray.map(e=>e.damage)).toEqual([45,45,48.6]);
 });
 it.each(['Trundle','Nasus','Garen','Yorick','XinZhao','Volibear','Camille'])('%s Q delivers on-hits once',alias=>{
  const result=calculate(c(alias),items([3091,3124]),base(alias,{mode:'cast-q',effects:{itemProcsReady:true}}));
  expect(result.events.filter(e=>e.name==='Wit’s End Fray')).toHaveLength(1);
  expect(result.events.filter(e=>e.name==='Guinsoo’s Rageblade Wrath')).toHaveLength(1);
 });
 it('uses Jhin prepared Rageblade AS in Whisper without inventing attacks',()=>{
  const setup=base('Jhin',{mode:'cast-w'});
  const a=calculate(c('Jhin'),items([3124]),setup),b=calculate(c('Jhin'),items([3124]),{...setup,effects:{ragebladeStacks:4}});
  const purchasedAD=items([3124])[0].baseStats.filter(v=>v.name==='Attack Damage').reduce((n,v)=>n+v.value,0);
  expect(b.stats.ad-a.stats.ad).toBeCloseTo((a.stats.baseAD+purchasedAD)*.3*.32);
  expect(b.events.filter(e=>e.origin==='native')).toHaveLength(a.events.filter(e=>e.origin==='native').length);
 });
 it('shares the target impairment condition with baseline Cheap Shot',()=>{
  const setup=base('Lux',{mode:'cast-q',runePage:[8126],effects:{runeProcsReady:true,targetImpaired:true}});
  const result=compareAtTarget(c('Lux'),[],[],setup,{...setup,effects:{runeProcsReady:true}});
  expect(result.baseline.procDamage).toBe(45);expect(result.delta).toBe(0);
 });
 it('runs all registered champion objectives with the newly shared rune/item layers',()=>{
  let count=0;
  for(const champion of data.champions)for(const objective of objectiveOptions(champion.alias)){
   const result=calculate(champion,items([3153,3091,3124]),{...base(champion.alias),mode:objective.mode,runePage:[8437,8005,8112,8126,8143],effects:{runeProcsReady:true,itemProcsReady:true,graspReady:true,ptaHitsBefore:2,electrocuteHitsBefore:2,targetImpaired:true,suddenImpactArmed:true,ragebladeStacks:4}});
   expect(Number.isFinite(result.damage),`${champion.alias}/${objective.mode}`).toBe(true);
   expect(result.damage).toBeCloseTo(result.nativeDamage!+result.procDamage!);count++;
  }
  expect(count).toBe(475);
 });
});
