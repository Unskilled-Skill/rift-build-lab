import {expect,it} from 'vitest';
import {calculate,defaultScenario} from '../src/engine';
import {objectiveSupport} from '../src/model-support';
import {defenseSweep,progressionRows} from '../src/comparison-lab';
import {parseSave} from '../src/storage';
import catalog from '../public/data/catalog.json';
import type {Catalog,Champion,Scenario} from '../src/types';
const data=catalog as unknown as Catalog;
const champion=(alias:string):Champion=>({id:0,alias,name:alias,title:'',roles:[],profile:null,stats:{hp:600,mp:500,attackdamage:60}});
const setup=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={}):Scenario=>({...defaultScenario(alias),mode,level:1,rank:1,mr:0,armor:0,mana:500,shards:[],runePage:[],extraAP:100,extraAD:40,...extra});
const result=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={})=>calculate(champion(alias),[],setup(alias,mode,extra));
it.each([
 ['Nautilus','cast-q',175,60],['Nautilus','cast-e',105,50],['Nautilus','cast-r',230,100],
 ['Sejuani','cast-q',165,60],['Sejuani','cast-w',172,60],['Sejuani','cast-e',125,20],['Sejuani','cast-r',165,100],
 ['Maokai','cast-q',125,40],['Maokai','cast-w',100,60],['Maokai','cast-e',75,60],['Maokai','cast-r',225,100],
 ['Sion','cast-q',70,45],['Sion','cast-q-max',210,45],['Sion','cast-w',430,75],['Sion','cast-e',120,35],['Sion','cast-r',174,100],
 ['Poppy','cast-q',470,35],['Poppy','cast-w',140,50],['Poppy','cast-e',64,70],['Poppy','cast-r',118,100],
 ['Alistar','cast-q',140,50],['Alistar','cast-w',155,50],
 ['Leona','cast-q',140,30],['Leona','cast-w',95,60],['Leona','cast-e',90,40],['Leona','cast-r',230,100],
 ['Braum','cast-q',90,45],['Braum','cast-r',210,100],
 ['Nunu','cast-q',125,60],['Nunu','cast-e',27,50],['Nunu','cast-r',925,100],
 ['Volibear','cast-q',174,50],['Volibear','cast-w',115,20],['Volibear','cast-w-empowered',184,20],['Volibear','cast-e',425,50],['Volibear','cast-r',525,100],
 ['Warwick','cast-q',370,80],
 ['XinZhao','cast-q',131,30],['XinZhao','cast-w',60,60],['XinZhao','cast-e',170,60],['XinZhao','cast-r',600,100],
 ['Vi','cast-q',64,50],['Vi','cast-q-max',160,50],['Vi','cast-e',220,26],['Vi','cast-r',186,100],
 ['Fizz','cast-q',165,50],['Fizz','cast-e',175,75],['Fizz','cast-r',240,100],['Fizz','cast-r-empowered',360,100],
 ['Fiddlesticks','cast-q',175,65],['Fiddlesticks','cast-e',120,40],
] as const)('%s %s matches independently reviewed rank-one damage and cost',(alias,mode,damage,cost)=>{
 expect(objectiveSupport(alias,mode).supported).toBe(true);
 const r=result(alias,mode);expect(r.damage).toBeCloseTo(damage);expect(r.manaSpent).toBe(cost);
});
it('distinguishes own total HP, own bonus HP and enemy maximum HP',()=>{
 expect(result('Sejuani','cast-w',{extraHP:1000}).damage).toBe(292);
 expect(result('Braum','cast-q',{extraHP:1000}).damage).toBe(115);
 expect(result('Maokai','cast-e',{extraHP:1000}).damage).toBe(125);
 expect(result('Nunu','cast-q',{extraHP:1000}).damage).toBe(175);
 expect(result('Sion','cast-w',{extraHP:1000}).damage).toBeCloseTo(430);
 expect(result('Warwick','cast-q',{targetHP:5000}).damage).toBe(520);
});
it('uses a supplied current-health percentage rather than maximum health for Xin R and Fiddle Q',()=>{
 expect(result('XinZhao','cast-r',{targetHealthPercent:50}).damage).toBe(412.5);
 expect(result('XinZhao','cast-r',{targetHealthPercent:0}).damage).toBe(225);
 expect(result('Fiddlesticks','cast-q',{targetHealthPercent:50}).damage).toBeCloseTo(87.5);
 expect(result('Fiddlesticks','cast-q',{targetHealthPercent:1}).damage).toBe(40);
 expect(result('Fiddlesticks','cast-q',{rank:5,targetHealthPercent:1}).damage).toBe(120);
});
it('accounts for delayed impacts only inside the observation window, while paying upfront mana',()=>{
 for(const [alias,mode,time,cost] of [['Sion','cast-w',3,75],['Leona','cast-w',3,60],['Nunu','cast-r',3,100],['Fizz','cast-r',2,100],['Fizz','cast-r-empowered',2,100]] as const){
  const before=result(alias,mode,{duration:time-.01}),hit=result(alias,mode,{duration:time});
  expect(before.damage).toBe(0);expect(before.manaSpent).toBe(cost);expect(hit.damage).toBeGreaterThan(0);expect(hit.events[0].time).toBe(time);
 }
 const early=result('Poppy','cast-q',{duration:.99}),both=result('Poppy','cast-q',{duration:1});
 expect(early.damage).toBeCloseTo(235);expect(both.damage).toBeCloseTo(470);expect(both.events.map(e=>e.time)).toEqual([0,1]);
});
it('uses the reviewed Volibear W2 bonus-AD multiplier and keeps setup out',()=>{
 expect(result('Volibear','cast-w-empowered',{extraHP:1000}).damage).toBeCloseTo(280);
 expect(result('Volibear','cast-w-empowered',{extraAD:1000}).damage).toBeCloseTo(4684);
 expect(result('Volibear','cast-w-empowered').limitations.join(' ')).toMatch(/already marked/i);
 expect(result('Volibear','cast-w-empowered').events).toHaveLength(1);
});
it('separates mixed delivery damage and uses the correct defenses for AP physical scalings',()=>{
 expect(result('Leona','cast-q').events.map(e=>e.type)).toEqual(['physical','magic']);
 expect(result('Fizz','cast-q',{armor:100,mr:0}).damage).toBe(115);
 expect(result('Sejuani','cast-w',{armor:100,mr:900}).damage).toBe(86);
 expect(result('Vi','cast-e',{armor:100,mr:900}).damage).toBe(110);
 expect(result('Volibear','cast-r',{armor:100,mr:900}).damage).toBe(262.5);
});
it('handles rank-dependent health ratios and charged damage without using a later rank',()=>{
 expect(result('Poppy','cast-q',{rank:5}).damage).toBe(770);
 expect(result('Volibear','cast-e',{rank:5}).damage).toBe(645);
 expect(result('Sion','cast-q-max',{rank:5}).damage).toBe(590);
 expect(result('Fizz','cast-r-empowered',{rank:5}).damage).toBe(720);
});
it('keeps conditional control and setup assumptions explicit',()=>{
 for(const [alias,mode,scope] of [['Sejuani','cast-e',/four Frost/i],['Poppy','cast-w',/dash/i],['Poppy','cast-e',/wall/i],['Sion','cast-w',/shield/i],['XinZhao','cast-w',/thrust/i],['Warwick','cast-q',/passive/i],['Fiddlesticks','cast-q',/not recently feared/i]] as const)
  expect(result(alias,mode).limitations.join(' ')).toMatch(scope);
});
it('keeps the new variant and target health in portable saves',()=>{
 const s={...defaultScenario('Fizz'),mode:'cast-r-empowered',targetHealthPercent:50};
 const parsed=parseSave(JSON.stringify({version:1,patch:'26.20',scenario:s,items:[]}),data.champions,data.items);
 expect(parsed.scenario.mode).toBe('cast-r-empowered');expect(parsed.scenario.targetHealthPercent).toBe(50);
 expect(()=>parseSave(JSON.stringify({version:1,patch:'26.20',scenario:{...s,champion:'Alistar'},items:[]}),data.champions,data.items)).toThrow();
});
it('uses current-health scaling consistently through target sweeps and purchase comparisons',()=>{
 const s=setup('XinZhao','cast-r',{targetHealthPercent:50});
 const sweep=defenseSweep(champion('XinZhao'),[],[],s,s,'targetHP',1000,3000);
 expect(sweep[0].experiment.damage).toBe(300);expect(sweep.at(-1)!.experiment.damage).toBe(450);
 expect(progressionRows(champion('XinZhao'),[],[],s,s,[3000,6000]).map(r=>r.experiment.damage)).toEqual([412.5,412.5]);
});
