import {expect,it} from 'vitest';
import {calculate,defaultScenario} from '../src/engine';
import {objectiveSupport} from '../src/model-support';
import {defenseSweep,progressionRows} from '../src/comparison-lab';
import {parseSave} from '../src/storage';
import catalog from '../public/data/catalog.json';
import source from '../src/ability-sources.json';
import type {Catalog,Champion,Scenario} from '../src/types';
const data=catalog as unknown as Catalog;
const champion=(alias:string):Champion=>({id:0,alias,name:alias,title:'',roles:[],profile:null,stats:{hp:600,mp:500,attackdamage:60}});
const setup=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={}):Scenario=>({...defaultScenario(alias),mode,level:1,rank:1,mr:0,armor:0,mana:500,shards:[],runePage:[],extraAP:100,extraAD:40,...extra});
const result=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={})=>calculate(champion(alias),[],setup(alias,mode,extra));
it.each([
 ['Galio','cast-q',140,60],['Galio','cast-w',50,50],['Galio','cast-e',200,50],
 ['Garen','cast-q',180,0],
 ['Kennen','cast-q',150,60],['Kennen','cast-w',150,40],['Kennen','cast-e',160,80],
 ['LeeSin','cast-q',96,50],['LeeSin','cast-e',125,50],['LeeSin','cast-r',255,0],
 ['Akali','cast-q',170,110],['Akali','cast-e',84,30],['Akali','cast-r',160,0],
 ['Zed','cast-q',120,75],['Zed','cast-e',98,40],['Shen','cast-e',60,150],
 ['Renekton','cast-q',100,0],['Renekton','cast-q-empowered',146,0],['Renekton','cast-w',160,0],['Renekton','cast-w-empowered',240,0],['Renekton','cast-e',76,0],
 ['Riven','cast-q',69,0],['Riven','cast-w',105,0],
 ['Aatrox','cast-q',70,0],['Aatrox','cast-q-empowered',122.5,0],['Aatrox','cast-w',70,0],
 ['RekSai','cast-q',130,0],['RekSai','cast-e',94,0],['RekSai','cast-e-empowered',112.8,0],
 ['Katarina','cast-q',120,0],['Katarina','cast-e',85,0],
] as const)('%s %s matches the reviewed damage and upfront resource cost',(alias,mode,damage,cost)=>{
 expect(objectiveSupport(alias,mode).supported).toBe(true);
 const r=result(alias,mode);expect(r.damage).toBeCloseTo(damage);expect(r.resource?.spent).toBe(cost);
});
it('energy uses the base champion cap, without mana items or mana-to-AD conversion',()=>{
 const muramana=data.items.find(i=>i.id===3042)!;
 const r=calculate(champion('Zed'),[muramana],setup('Zed','cast-q',{mana:10000,extraAP:0,extraAD:0}));
 expect(r.resource).toEqual({kind:'energy',maximum:200,spent:75});expect(r.manaSpent).toBe(0);expect(r.stats.mana).toBe(0);
 expect(r.stats.bonusAD).toBe(muramana.baseStats.filter(s=>s.name==='Attack Damage').reduce((n,s)=>n+s.value,0));
 const rod=data.items.find(i=>i.id===6657)!;
 expect(calculate(champion('Zed'),[rod],setup('Zed','cast-q',{rodStacks:10})).resource?.maximum).toBe(200);
 expect(calculate(champion('Zed'),[rod],setup('Zed','cast-q',{rodStacks:10})).stats.mana).toBe(0);
});
it('keeps reviewed energy caps aligned with the bundled champion stats',()=>{
 for(const [alias,rule] of Object.entries(source.resources))if(rule.kind==='energy'){
  expect(rule.sourceType).toBe('Energy');expect(rule.baseMaximum).toBe(data.champions.find(c=>c.alias===alias)!.stats.mp);
 }
});
it('energy abilities require the upfront cost; zero-cost ultimates still work at zero energy',()=>{
 expect(result('Akali','cast-q',{mana:109}).damage).toBe(0);
 expect(result('Akali','cast-q',{mana:110}).damage).toBe(170);
 expect(result('LeeSin','cast-r',{mana:0}).damage).toBe(255);
 expect(result('Akali','cast-r',{mana:0}).damage).toBe(160);
 const shen=result('Shen','cast-e',{mana:1000,extraHP:1000});
 expect(shen.resource).toEqual({kind:'energy',maximum:400,spent:150});expect(shen.damage).toBe(170);
 expect(result('Shen','cast-e',{mana:149}).damage).toBe(0);
});
it('zero-cost fighters can cast at zero resource and never inherit Fury as mana',()=>{
 for(const alias of ['Garen','Renekton','Riven','Aatrox','RekSai','Katarina']){
  const mode=defaultScenario(alias).mode,r=result(alias,mode,{mana:0});
  expect(r.damage).toBeGreaterThan(0);expect(r.resource).toEqual({kind:'none',maximum:0,spent:0});expect(r.stats.mana).toBe(0);
 }
});
it('separates magic AD scaling, physical delivery attacks and true damage',()=>{
 expect(result('LeeSin','cast-e',{armor:900,mr:100}).damage).toBe(62.5);
 expect(result('Garen','cast-q',{armor:100,mr:900}).damage).toBe(90);
 expect(result('RekSai','cast-e-empowered',{armor:1000,mr:1000}).damage).toBeCloseTo(112.8);
 expect(result('RekSai','cast-e-empowered').events[0].type).toBe('true');
 expect(result('Akali','cast-r',{armor:900,mr:100}).damage).toBe(80);
});
it('keeps explicit fury and sweet-spot prerequisites with the selected variant',()=>{
 expect(result('Renekton','cast-w-empowered').events).toHaveLength(3);
 expect(result('Renekton','cast-w').events).toHaveLength(2);
 expect(result('Renekton','cast-q-empowered').limitations.join(' ')).toMatch(/50 Fury/i);
 expect(result('Aatrox','cast-q-empowered').limitations.join(' ')).toMatch(/first.*sweet spot/i);
 expect(result('Kennen','cast-w').limitations.join(' ')).toMatch(/already.*Mark/i);
});
it('new variants survive saves and stay champion-specific',()=>{
 const s={...defaultScenario('Renekton'),mode:'cast-w-empowered'};
 expect(parseSave(JSON.stringify({version:1,patch:'26.20',scenario:s,items:[]}),data.champions,data.items).scenario.mode).toBe('cast-w-empowered');
 expect(()=>parseSave(JSON.stringify({version:1,patch:'26.20',scenario:{...s,champion:'Garen'},items:[]}),data.champions,data.items)).toThrow();
});
it('non-mana adapters retain comparison support and correct adaptive preference',()=>{
 const s=setup('RekSai','cast-e-empowered');
 expect(new Set(defenseSweep(champion('RekSai'),[],[],s,s,'armor',0,500).map(r=>r.experiment.damage)).size).toBe(1);
 expect(progressionRows(champion('RekSai'),[],[],s,s,[3000,6000]).map(r=>r.experiment.resource?.spent)).toEqual([0,0]);
 for(const alias of ['Garen','LeeSin','Zed','Shen','Renekton','Riven','Aatrox','RekSai','Akali']){
  expect(result(alias,defaultScenario(alias).mode,{extraAD:0,extraAP:0,shards:[5008,5008]}).stats.bonusAD).toBeCloseTo(10.8);
 }
});
