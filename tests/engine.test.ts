import { describe, it, expect } from 'vitest';
import { calculate, growth, mitigate, legalBuild, defaultScenario } from '../src/engine';
import type { Champion, Item } from '../src/types';
const champ = (alias: string): Champion => ({id:alias==='Sett'?875:69,alias,name:alias,title:'',roles:[],stats:{hp:alias==='Sett'?670:610,hpperlevel:alias==='Sett'?114:98,mp:450,mpperlevel:40,attackdamage:60,attackdamageperlevel:0},profile:null});
const item = (id:number,stats:Item['baseStats'],cost=3000):Item => ({id,name:String(id),baseStats:stats,gold:{total:cost},descriptionText:'',effectDescriptionText:'',shopListedBySource:true,maps:{'11':true},requiredChampion:null,buildsInto:[],tags:[],iconUrl:''});
describe('independent damage fixtures',()=>{
 it('keeps a completed Q poison when mana prevents the scheduled recast',()=>{const s={...defaultScenario('Cassiopeia'),level:1,rank:1,eRank:1,mode:'sequence' as const,duration:4,mana:185,mr:0,shards:[5005,5010,5011]};const r=calculate(champ('Cassiopeia'),[item(998,[{name:'Ability Haste',value:40,unit:'flat'}])],s);expect(r.events.filter(e=>e.name.startsWith('Noxious')).reduce((n,e)=>n+e.raw,0)).toBe(65)});
 it('applies Shojin basic haste to Q as well as E',()=>{const s={...defaultScenario('Cassiopeia'),mode:'sequence' as const,duration:3,mana:2000};expect(calculate(champ('Cassiopeia'),[item(3161,[])],s).events.filter(e=>e.name.startsWith('Noxious')).length).toBe(2)});
 it('uses non-linear champion stat growth',()=>{expect(growth(1)).toBe(0);expect(growth(18)).toBe(17);expect(growth(2)).toBeCloseTo(.72)});
 it('mitigates positive and negative resistance without penetration making it negative',()=>{expect(mitigate(100,100)).toBe(50);expect(mitigate(100,-50)).toBeCloseTo(133.33333);expect(mitigate(100,20,0,40)).toBe(100)});
 it('Q plus poisoned E at level 18, 200 AP, zero MR equals 725',()=>{
  const s={...defaultScenario('Cassiopeia'),level:18,mr:0,mode:'qe' as const,extraAP:200,shards:[5005,5010,5011]};
  expect(calculate(champ('Cassiopeia'),[],s).damage).toBeCloseTo(725,2);
 });
 it('unpoisoned E has no bonus and costs 45 mana',()=>{const s={...defaultScenario('Cassiopeia'),level:1,mr:0,mode:'e' as const,poisoned:false,extraAP:100,shards:[5005,5010,5011]};const r=calculate(champ('Cassiopeia'),[],s);expect(r.damage).toBeCloseTo(70);expect(r.manaSpent).toBe(45)});
 it('stops casting on insufficient mana for either ability',()=>{const r=calculate(champ('Cassiopeia'),[],{...defaultScenario('Cassiopeia'),mode:'sequence',mana:44});expect(r.damage).toBe(0);expect(r.events).toHaveLength(0)});
 it('still casts affordable E when Q cannot be paid',()=>{const r=calculate(champ('Cassiopeia'),[],{...defaultScenario('Cassiopeia'),mode:'sequence',duration:5,mana:340});expect(r.manaSpent).toBe(340)});
 it('does not carry the single-E poison flag into a repeated sequence',()=>{const s={...defaultScenario('Cassiopeia'),mode:'sequence' as const,mana:49};expect(calculate(champ('Cassiopeia'),[],{...s,poisoned:true}).damage).toBe(calculate(champ('Cassiopeia'),[],{...s,poisoned:false}).damage)});
 it('integrates Riftmaker combat ramp across a full Q poison',()=>{const s={...defaultScenario('Cassiopeia'),level:1,rank:1,mr:0,mode:'q' as const,shards:[5005,5010,5013]};expect(calculate(champ('Cassiopeia'),[item(4633,[{name:'Ability Power',value:70,unit:'flat'}])],s).damage).toBeCloseTo(119.85)});
 it('Sett W caps absolute grit at half health and ignores armor in center',()=>{
  const s={...defaultScenario('Sett'),level:1,rank:5,gritMode:'absolute' as const,grit:99999,extraAD:100,shards:[5005,5010,5011]};
  const r=calculate(champ('Sett'),[],s);expect(r.stats.hp).toBe(735);expect(r.grit).toBe(367.5);expect(r.damage).toBeCloseTo(343.75);
 });
 it('adds Warmog item-health then Bloodmail conversion and Deathcap last',()=>{
  const items=[item(3083,[{name:'Health',value:1000,unit:'flat'}]),item(2501,[{name:'Health',value:550,unit:'flat'},{name:'Attack Damage',value:30,unit:'flat'}]),item(4633,[{name:'Ability Power',value:70,unit:'flat'}]),item(3089,[{name:'Ability Power',value:130,unit:'flat'}])];
  const r=calculate(champ('Sett'),items,{...defaultScenario('Sett'),level:1,shards:[5005,5010,5011]});
  expect(r.stats.bonusHP).toBeCloseTo(1801);expect(r.stats.bonusAD).toBeCloseTo(75.025);expect(r.stats.ap).toBeCloseTo((200+1801*.02)*1.3);
 });
 it('rejects duplicates, budget violations and penetration family conflicts',()=>{
  const a=item(3135,[]),b=item(3137,[]);expect(legalBuild([a,a],10000,6,'Sett')).toBe(false);expect(legalBuild([a],2000,6,'Sett')).toBe(false);expect(legalBuild([a,b],10000,6,'Sett')).toBe(false);
 });
 it('records unknown item effects as omitted',()=>{const r=calculate(champ('Sett'),[item(999,[])],defaultScenario('Sett'));expect(r.limitations.join(' ')).toContain('999')});
});



it('allows earned Muramana without allowing arbitrary hidden source items or both Tear forms',()=>{const muramana={...item(3042,[]),shopListedBySource:false};expect(legalBuild([muramana],10000,6,'Blitzcrank')).toBe(true);expect(legalBuild([muramana,item(3004,[])],10000,6,'Blitzcrank')).toBe(false);expect(legalBuild([{...item(999,[]),shopListedBySource:false}],10000,6,'Blitzcrank')).toBe(false);expect(legalBuild([{...muramana,maps:{'11':false}}],10000,6,'Blitzcrank')).toBe(false)});
