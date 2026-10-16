import {expect,it} from 'vitest';
import {calculate,defaultScenario} from '../src/engine';
import {objectiveOptions,objectiveSupport} from '../src/model-support';
import {defenseSweep} from '../src/comparison-lab';
import {parseSave} from '../src/storage';
import catalog from '../public/data/catalog.json';
import type {Catalog,Champion,Scenario} from '../src/types';
const data=catalog as unknown as Catalog;
const champion=(alias:string):Champion=>({id:0,alias,name:alias,title:'',roles:[],profile:null,stats:{hp:600,mp:500,attackdamage:60}});
const scenario=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={}):Scenario=>({...defaultScenario(alias),mode,level:1,rank:1,mr:0,armor:0,mana:500,shards:[],runePage:[],extraAP:100,extraAD:40,...extra});
const result=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={})=>calculate(champion(alias),[],scenario(alias,mode,extra));
it.each([
 ['Brand','cast-q',135,70],['Brand','cast-w',145,60],['Brand','cast-e',115,90],['Brand','cast-r',130,100],
 ['Velkoz','cast-q',170,40],['Velkoz','cast-w',50,50],['Velkoz','cast-e',100,50],
 ['Xerath','cast-q',160,80],['Xerath','cast-w',115,80],['Xerath','cast-e',115,60],['Xerath','cast-r',215,100],
 ['Neeko','cast-q',120,50],['Neeko','cast-e',145,60],
 ['Vex','cast-q',140,45],['Vex','cast-w',110,75],['Vex','cast-e',90,70],['Vex','cast-r',95,100],
 ['Seraphine','cast-e',120,60],['Seraphine','cast-r',190,100],
 ['Karma','cast-q',130,40],['Karma','cast-w',85,50],
 ['Nami','cast-q',140,60],['Nami','cast-w',110,70],['Nami','cast-r',210,100],
 ['Janna','cast-q',105,90],['Janna','cast-q-max',165,90],
 ['Leblanc','cast-q',105,50],['Leblanc','cast-w',165,60],['Leblanc','cast-e',90,50],
 ['Lucian','cast-q',130,48],['Lucian','cast-w',165,60],
 ['Corki','cast-q',210,60],['Corki','cast-r',124,35],
] as const)('%s %s matches reviewed rank-one damage and mana',(alias,mode,damage,cost)=>{
 expect(objectiveSupport(alias,mode).supported).toBe(true);
 const actual=result(alias,mode);expect(actual.damage).toBeCloseTo(damage);expect(actual.manaSpent).toBe(cost);
});
it('defaults every registered champion to an objective it actually supports',()=>{
 for(const alias of ['Brand','Velkoz','Xerath','Neeko','Vex','Seraphine','Karma','Nami','Janna','Leblanc','Lucian','Corki']){
  const s=defaultScenario(alias);expect(objectiveSupport(alias,s.mode).supported).toBe(true);
  expect(objectiveOptions(alias).map(o=>o.mode)).toContain(s.mode);
 }
 expect(defaultScenario('Seraphine').mode).toBe('cast-e');
});
it('uses bonus AD for Lucian Q and Corki Q/R, with their correct damage types',()=>{
 expect(result('Lucian','cast-q',{extraAD:0,extraAP:0}).damage).toBe(90);
 expect(result('Corki','cast-q',{extraAD:0,extraAP:0}).damage).toBe(60);
 expect(result('Corki','cast-r',{extraAD:0,extraAP:1000}).damage).toBe(90);
 expect(result('Corki','cast-q',{mr:100,armor:900}).damage).toBe(105);
 expect(result('Corki','cast-r',{mr:900,armor:100}).damage).toBe(62);
 expect(result('Lucian','cast-q',{mr:900,armor:100}).damage).toBe(65);
});
it('keeps charged Janna Q separate and applies rank-dependent Vex E scaling',()=>{
 expect(result('Janna','cast-q-max',{rank:5}).damage).toBe(365);
 expect(result('Vex','cast-e',{rank:5}).damage).toBe(190);
 expect(result('Janna','cast-q-max').limitations.join(' ')).toMatch(/three seconds of prior/i);
});
it('never grants untriggered secondary hits or passive damage',()=>{
 for(const [alias,mode,scope] of [
  ['Brand','cast-r',/one bounce/i],['Velkoz','cast-w',/initial/i],['Neeko','cast-q',/initial/i],
  ['Vex','cast-r',/initial/i],['Karma','cast-w',/initial/i],['Leblanc','cast-q',/mark/i],['Leblanc','cast-e',/initial/i],
 ] as const){const r=result(alias,mode);expect(r.events).toHaveLength(1);expect(r.limitations.join(' ')).toMatch(scope);}
});
it('AD casters start with AD adaptive force, but an AP build can switch it',()=>{
 for(const alias of ['Lucian','Corki']){
  expect(result(alias,'cast-q',{extraAD:0,extraAP:0,shards:[5008,5008]}).stats.bonusAD).toBeCloseTo(10.8);
  expect(result(alias,'cast-q',{extraAD:0,extraAP:100,shards:[5008,5008]}).stats.ap).toBe(118);
 }
});
it('supports saved comparisons and correct defense sweeps for the new objectives',()=>{
 const s=scenario('Corki','cast-r');
 const saved=parseSave(JSON.stringify({version:1,patch:'26.20',scenario:{...s,shards:defaultScenario('Corki').shards,runePage:defaultScenario('Corki').runePage},items:[]}),data.champions,data.items);
 expect(saved.scenario.mode).toBe('cast-r');
 const rows=defenseSweep(champion('Corki'),[],[],s,s,'armor',0,100);
 expect(rows[0].experiment.damage).toBe(124);expect(rows.at(-1)!.experiment.damage).toBe(62);
});
