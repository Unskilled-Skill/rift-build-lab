import {expect,it} from 'vitest';
import {calculate,defaultScenario} from '../src/engine';
import {objectiveOptions,objectiveSupport} from '../src/model-support';
import {defenseSweep,progressionRows} from '../src/comparison-lab';
import {parseSave} from '../src/storage';
import catalog from '../public/data/catalog.json';
import type {Catalog,Champion,Scenario} from '../src/types';
const data=catalog as unknown as Catalog;
const champion=(alias:string):Champion=>({id:0,alias,name:alias,title:'',roles:[],profile:null,stats:{hp:600,mp:500,attackdamage:60}});
const scenario=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={}):Scenario=>({...defaultScenario(alias),mode,level:1,rank:1,mr:0,armor:0,mana:500,shards:[],runePage:[],extraAP:100,extraAD:40,...extra});
const result=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={})=>calculate(champion(alias),[],scenario(alias,mode,extra));
const fixtures=[
 ['Caitlyn','cast-q',175,55],['Caitlyn','cast-e',160,75],
 ['Ashe','cast-w',100,75],['Ashe','cast-r',320,100],
 ['MissFortune','cast-q',155,40],
 ['Draven','cast-e',95,70],['Draven','cast-r',244,100],
 ['Graves','cast-q',72,80],['Graves','cast-w',120,70],['Graves','cast-r',335,100],
 ['Quinn','cast-q',147,50],['Quinn','cast-e',48,50],
 ['JarvanIV','cast-e',160,55],['JarvanIV','cast-r',272,100],
 ['Nocturne','cast-q',99,60],['Nocturne','cast-r',198,100],
 ['Talon','cast-q',105,40],['Talon','cast-w',66,50],['Talon','cast-r',130,100],
 ['Pantheon','cast-r',400,100],
 ['Orianna','cast-q',115,35],['Orianna','cast-w',150,60],['Orianna','cast-e',90,60],['Orianna','cast-r',335,100],
 ['Diana','cast-q',140,50],['Diana','cast-w',114,40],['Diana','cast-e',110,40],
 ['Lissandra','cast-q',155,55],['Lissandra','cast-w',140,40],['Lissandra','cast-e',130,80],['Lissandra','cast-r',225,100],
 ['Syndra','cast-q',160,40],['Syndra','cast-w',135,60],['Syndra','cast-e',120,50],['Syndra','cast-r',300,100],
 ['Anivia','cast-q',180,80],['Anivia','cast-e',110,50],['Anivia','cast-e-empowered',220,50],
] as const;
it.each(fixtures)('%s %s matches reviewed rank-one damage and cost',(alias,mode,damage,cost)=>{
 expect(objectiveSupport(alias,mode).supported).toBe(true);
 const actual=result(alias,mode);expect(actual.damage).toBeCloseTo(damage);expect(actual.manaSpent).toBe(cost);
});
it('supports rank-dependent total AD and bonus AD coefficients independently',()=>{
 expect(result('Caitlyn','cast-q',{rank:5}).damage).toBeCloseTo(415);
 expect(result('Quinn','cast-q',{rank:5}).damage).toBe(295);
 expect(result('Draven','cast-r',{rank:5}).damage).toBe(460);
 expect(result('Caitlyn','cast-q',{extraAP:0,extraAD:0}).damage).toBe(125);
 expect(result('Ashe','cast-w',{extraAP:1000,extraAD:0}).damage).toBe(60);
});
it('keeps chilled Anivia E explicit, with no free chill setup damage or mana',()=>{
 const plain=result('Anivia','cast-e'),chilled=result('Anivia','cast-e-empowered');
 expect(chilled.damage).toBe(plain.damage*2);expect(chilled.manaSpent).toBe(50);expect(chilled.events).toHaveLength(1);
 expect(chilled.limitations.join(' ')).toMatch(/already Chilled/i);
 expect(objectiveOptions('Anivia').map(o=>o.mode)).toContain('cast-e-empowered');
 const s={...defaultScenario('Anivia'),mode:'cast-e-empowered'};
 expect(parseSave(JSON.stringify({version:1,patch:'26.20',scenario:s,items:[]}),data.champions,data.items).scenario.mode).toBe('cast-e-empowered');
 expect(()=>parseSave(JSON.stringify({version:1,patch:'26.20',scenario:{...s,champion:'Ashe'},items:[]}),data.champions,data.items)).toThrow();
});
it('splits Anivia Q and Diana W into only the declared hit packets',()=>{
 expect(result('Anivia','cast-q').events.map(e=>e.raw)).toEqual([75,105]);
 expect(result('Diana','cast-w').events.map(e=>e.raw)).toEqual([38,38,38]);
 expect(result('Syndra','cast-r').events.map(e=>e.raw)).toEqual([100,100,100]);
});
it('uses armor for AD spells and magic resist for hybrid and AP spell damage',()=>{
 expect(result('Caitlyn','cast-q',{armor:100,mr:900}).damage).toBe(87.5);
 expect(result('Caitlyn','cast-e',{armor:900,mr:100}).damage).toBe(80);
 expect(result('Ashe','cast-r',{armor:900,mr:100}).damage).toBe(160);
 expect(result('Quinn','cast-q',{armor:100,mr:900}).damage).toBe(73.5);
 expect(result('JarvanIV','cast-e',{armor:900,mr:100}).damage).toBe(80);
});
it('limits direct-hit and unupgraded objectives instead of assuming conditional damage',()=>{
 for(const [alias,mode,scope] of [
  ['Caitlyn','cast-q',/first target/i],['MissFortune','cast-q',/Love Tap/i],['Draven','cast-r',/Adoration/i],
  ['Graves','cast-q',/initial/i],['Graves','cast-r',/direct/i],['Talon','cast-q',/ranged/i],
  ['Talon','cast-r',/outward/i],['Pantheon','cast-r',/spear/i],['Syndra','cast-w',/60 Splinters/i],
 ] as const)expect(result(alias,mode).limitations.join(' ')).toMatch(scope);
});
it('defaults every new champion to a supported objective and rejects insufficient mana',()=>{
 for(const [alias,mode] of fixtures){
  expect(objectiveSupport(alias,defaultScenario(alias).mode).supported).toBe(true);
  expect(result(alias,mode,{mana:0}).damage).toBe(0);
 }
 expect(defaultScenario('Ashe').mode).toBe('cast-w');expect(defaultScenario('JarvanIV').mode).toBe('cast-e');expect(defaultScenario('Pantheon').mode).toBe('cast-r');
});
it('uses the engine-source adaptive preference for every added AD champion',()=>{
 for(const alias of ['Caitlyn','Ashe','MissFortune','Draven','Graves','Quinn','JarvanIV','Nocturne','Talon','Pantheon']){
  const mode=defaultScenario(alias).mode;
  expect(result(alias,mode,{extraAD:0,extraAP:0,shards:[5008,5008]}).stats.bonusAD).toBeCloseTo(10.8);
  expect(result(alias,mode,{extraAD:0,extraAP:100,shards:[5008,5008]}).stats.ap).toBe(118);
 }
});
it('runs new variants through shared defense and progression comparisons',()=>{
 const s=scenario('Anivia','cast-e-empowered');
 const sweep=defenseSweep(champion('Anivia'),[],[],s,s,'mr',0,100);
 expect(sweep[0].experiment.damage).toBe(220);expect(sweep.at(-1)!.experiment.damage).toBe(110);
 expect(progressionRows(champion('Anivia'),[],[],s,s,[3000,6000]).map(r=>r.experiment.damage)).toEqual([220,220]);
});
