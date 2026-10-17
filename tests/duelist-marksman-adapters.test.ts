import {it,expect} from 'vitest';
import {calculate,defaultScenario} from '../src/engine';
import {parseSave} from '../src/storage';
import {comparisonScenario} from '../src/workspace-draft';
import {defenseSweep,progressionRows} from '../src/comparison-lab';
import catalog from '../public/data/catalog.json';
import type {Champion,Scenario,Catalog,Item} from '../src/types';
const champion=(alias:string):Champion=>({id:0,alias,name:alias,title:'',roles:[],profile:null,stats:{hp:600,hpperlevel:0,mp:1000,mpperlevel:0,attackdamage:60,attackdamageperlevel:0}});
const setup=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={}):Scenario=>({...defaultScenario(alias),mode,level:1,rank:1,mr:0,armor:0,mana:1000,shards:[],runePage:[],extraAP:100,extraAD:40,targetHP:2500,duration:4,...extra});
const result=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={},items:Item[]=[])=>calculate(champion(alias),items,setup(alias,mode,extra));
it.each([
 ['Camille','cast-q',120,25],['Camille','cast-q-empowered',140,25],['Camille','cast-w',84,50],['Camille','cast-w-empowered',284,50],['Camille','cast-e',90,70],
 ['Fiora','cast-q',106,20],['Fiora','cast-w',210,50],
 ['Gangplank','cast-q',110,50],['Gangplank','cast-r',50,100],
 ['Illaoi','cast-w',262.5,30],['Illaoi','cast-r',170,100],
 ['Irelia','cast-q',85,15],['Irelia','cast-w',100,70],['Irelia','cast-w-empowered',300,70],['Irelia','cast-e',170,50],['Irelia','cast-r',225,100],
 ['Kaisa','cast-q',82,55],['Kaisa','cast-q-isolated',184.5,55],['Kaisa','cast-q-empowered',307.5,55],['Kaisa','cast-w',205,55],
 ['Kalista','cast-q',115,60],
 ['Kled','cast-q',54,0],['Kled','cast-q-empowered',162,0],['Kled','cast-e',57,0],['Kled','cast-r',130,0],['Kled','cast-r-empowered',390,0],
 ['Naafiri','cast-q',96.6,50],['Naafiri','cast-e',123,40],['Naafiri','cast-r',165,100],
 ['Qiyana','cast-q',116,35],['Qiyana','cast-e',70,40],['Qiyana','cast-r',400,100],
 ['Samira','cast-q',110,30],['Samira','cast-w',80,60],['Samira','cast-e',58,40],
 ['Trundle','cast-q',125,20],
 ['Varus','cast-q',85.33376,50],['Varus','cast-q-max',128,50],['Varus','cast-e',96,90],['Varus','cast-r',250,100],
 ['Xayah','cast-q',130,35],['Xayah','cast-r',240,100],
 ['Yorick','cast-q',180,20],['Yorick','cast-e',225,50],
 ['Yasuo','cast-q',125,0],['Yasuo','cast-e',138,0],['Yasuo','cast-e-empowered',276,0],['Yasuo','cast-r',260,0],
 ['Yone','cast-q',135,0],['Yone','cast-w',210,0],['Yone','cast-r',232,0],
 ['Kayle','cast-q',134,60],['Kayle','cast-r',310,100],
 ['KogMaw','cast-q',170,40],['KogMaw','cast-w',212.5,40],['KogMaw','cast-e',135,40],['KogMaw','cast-r',165,40],
 ['Kindred','cast-q',70,35],['Kindred','cast-w',90.5,40],
] as const)('%s %s has independently checked rank-one damage and cost',(alias,mode,damage,cost)=>{
 expect(result(alias,mode).damage).toBeCloseTo(damage);expect(result(alias,mode).manaSpent).toBe(cost);
});
it('Kalista requires prepared spears and spends no mana when none exist',()=>{
 expect(result('Kalista','cast-e').damage).toBe(0);expect(result('Kalista','cast-e').manaSpent).toBe(0);
 expect(result('Kalista','cast-e').limitations.join(' ')).toMatch(/requires at least one/i);
 expect(result('Kalista','cast-e',{abilityStacks:1}).damage).toBe(140);
 const three=result('Kalista','cast-e',{abilityStacks:3});expect(three.damage).toBe(294);expect(three.manaSpent).toBe(30);
 expect(result('Kalista','cast-e',{abilityStacks:254}).damage).toBe(19621);
 expect(result('Kalista','cast-e',{abilityStacks:1000}).damage).toBe(19621);
 expect(result('Kalista','cast-e',{abilityStacks:3,rank:5}).damage).toBe(450);
});
it('Kindred uses earned marks and current target HP for exactly one Wolf bite',()=>{
 expect(result('Kindred','cast-w',{abilityStacks:4}).damage).toBe(190.5);
 expect(result('Kindred','cast-w',{abilityStacks:4,targetHealthPercent:50}).damage).toBe(121.75);
 expect(result('Kindred','cast-q',{abilityStacks:4}).damage).toBe(70);
});
it('Camille Q2 converts only the selected attack and reaches full true damage at level sixteen',()=>{
 const low=result('Camille','cast-q-empowered',{armor:100,mr:1000});expect(low.damage).toBe(98);
 expect(low.events.map(e=>[e.type,e.raw])).toEqual([['physical',84],['true',56]]);
 expect(result('Camille','cast-q-empowered',{level:16,armor:10000}).damage).toBe(140);
 expect(result('Camille','cast-q-empowered',{level:18,rank:5,armor:10000}).damage).toBe(180);
});
it('KaiSa additional missiles use quarter damage without reducing the first missile',()=>{
 expect(result('Kaisa','cast-q-isolated',{extraAD:0,extraAP:0}).damage).toBe(90);
 expect(result('Kaisa','cast-q-empowered',{extraAD:0,extraAP:0}).damage).toBe(150);
 expect(result('Kaisa','cast-q-isolated',{rank:5}).damage).toBe(319.5);
 expect(result('Kaisa','cast-q-empowered').limitations.join(' ')).toMatch(/already evolved/i);
});
it('clips Kled tether, Samira second slash, Naafiri bleed and Xayah landing by their windows',()=>{
 expect(result('Kled','cast-q-empowered',{duration:1.74}).damage).toBe(54);
 expect(result('Kled','cast-q-empowered',{duration:1.75}).damage).toBe(162);
 expect(result('Samira','cast-w',{duration:.74}).damage).toBe(40);
 expect(result('Samira','cast-w',{duration:.75}).damage).toBe(80);
 expect(result('Naafiri','cast-q',{duration:5}).damage).toBeCloseTo(110);
 expect(result('Naafiri','cast-q',{duration:60}).damage).toBeCloseTo(110);
 expect(result('Xayah','cast-r',{duration:1.49}).damage).toBe(0);
 expect(result('Xayah','cast-r',{duration:1.5}).damage).toBe(240);
});
it('KogMaw first-shot R ramps above the threshold and doubles strictly below forty percent',()=>{
 expect(result('KogMaw','cast-r',{targetHealthPercent:50}).damage).toBeCloseTo(233.75);
 expect(result('KogMaw','cast-r',{targetHealthPercent:40}).damage).toBeCloseTo(247.5);
 expect(result('KogMaw','cast-r',{targetHealthPercent:39.99}).damage).toBe(330);
 expect(result('KogMaw','cast-r',{targetHealthPercent:39.99,rank:5}).damage).toBe(510);
});
it('splits Yone packets and keeps KogMaw noncritical attack delivery physical',()=>{
 expect(result('Yone','cast-w',{armor:100,mr:0}).damage).toBe(157.5);
 expect(result('Yone','cast-r',{armor:100,mr:0}).damage).toBe(174);
 expect(result('KogMaw','cast-w',{armor:100,mr:0}).damage).toBe(162.5);
 expect(result('Irelia','cast-w-empowered',{armor:100,mr:10000}).damage).toBe(150);
});
it('new no-mana champions ignore mana purchases and do not create mana-to-AD conversion',()=>{
 const mura=catalog.items.find(i=>i.id===3042)! as Item;
 for(const alias of ['Kled','Yasuo','Yone']){
  const r=result(alias,'cast-q',{mana:0},[mura]);expect(r.resource?.kind).toBe('none');expect(r.stats.mana).toBe(0);expect(r.stats.bonusAD).toBe(40+mura.baseStats.filter(s=>s.name==='Attack Damage').reduce((n,s)=>n+s.value,0));expect(r.damage).toBeGreaterThan(0);
 }
});
it('stack metadata is portable, bounded and shared by purchase/defense comparisons',()=>{
 const data=catalog as unknown as Catalog;const scenario={...defaultScenario('Kalista'),mode:'cast-e' as const,abilityStacks:3};
 const saved=(s:Scenario)=>parseSave(JSON.stringify({version:1,patch:'26.20',scenario:s,items:[]}),data.champions,data.items);
 expect(saved(scenario).scenario.abilityStacks).toBe(3);expect(()=>saved({...scenario,abilityStacks:255})).toThrow(/abilityStacks/);
 const s=setup('Kalista','cast-e',{abilityStacks:3});const base=comparisonScenario(s,{ids:[],names:[]});expect(base.abilityStacks).toBe(3);
 const sweep=defenseSweep(champion('Kalista'),[],[],s,base,'armor',0,100);expect(sweep[0].experiment.damage).toBe(294);expect(sweep.at(-1)!.experiment.damage).toBe(147);
 expect(progressionRows(champion('Kalista'),[],[],s,base,[3000,6000]).map(r=>r.experiment.damage)).toEqual([294,294]);
});
