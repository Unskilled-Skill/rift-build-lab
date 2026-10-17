import {it,expect} from 'vitest';
import {calculate,defaultScenario} from '../src/engine';
import {parseSave} from '../src/storage';
import catalog from '../public/data/catalog.json';
import {comparisonScenario} from '../src/workspace-draft';
import {defenseSweep} from '../src/comparison-lab';
import type {Catalog} from '../src/types';
import {abilityModel} from '../src/ability-models';
import type {Champion,Scenario} from '../src/types';
const champion=(alias:string):Champion=>({id:0,alias,name:alias,title:'',roles:[],profile:null,stats:{hp:600,hpperlevel:0,mp:1000,mpperlevel:0,attackdamage:60,attackdamageperlevel:0}});
const result=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={})=>calculate(champion(alias),[],{...defaultScenario(alias),mode,level:1,rank:1,mr:0,armor:0,mana:1000,shards:[],runePage:[],extraAP:100,extraAD:40,targetHP:2500,duration:10,...extra});
it.each([
 ['Senna','cast-q',54,70],['Senna','cast-w',106,50],['Senna','cast-r',366,100],
 ['Skarner','cast-q',321,30],['Skarner','cast-w',130,60],['Skarner','cast-e',114,50],['Skarner','cast-r',250,100],
 ['Rumble','cast-q',305,0],['Rumble','cast-q-empowered',457.5,0],['Rumble','cast-r',697.5,0],
 ['Zoe','cast-w',25,0],['Zoe','cast-e',115,80],['Darius','cast-r',155,100],
] as const)('%s %s uses independently checked damage and cost',(alias,mode,damage,cost)=>{
 expect(abilityModel(alias,mode)).toBeDefined();const r=result(alias,mode);expect(r.damage).toBeCloseTo(damage);expect(r.manaSpent).toBe(cost);
});
it('Darius R scales only with existing bleed and explicit bonus AD; true damage ignores defenses',()=>{
 expect(result('Darius','cast-r',{abilityStacks:3,mr:999,armor:999}).damage).toBe(248);
 expect(result('Darius','cast-r',{abilityStacks:5}).damage).toBe(310);
 expect(result('Darius','cast-r',{abilityStacks:50}).damage).toBe(310);
 const rank3=result('Darius','cast-r',{rank:3,abilityStacks:5,mana:0});expect(rank3.damage).toBe(810);expect(rank3.manaSpent).toBe(0);
 expect(rank3.limitations.join(' ')).toMatch(/Noxian Might.*excluded/);
});
it('Skarner distinguishes own bonus HP, own total HP and enemy maximum HP',()=>{
 expect(result('Skarner','cast-q',{extraHP:1000}).damage).toBeCloseTo(351);
 expect(result('Skarner','cast-e',{extraHP:1000}).damage).toBeCloseTo(174);
 expect(result('Skarner','cast-q',{targetHP:5000,targetHealthPercent:1}).damage).toBeCloseTo(596);
 expect(result('Skarner','cast-e',{targetHP:5000}).damage).toBeCloseTo(114);
 expect(result('Skarner','cast-q',{armor:100,mr:999}).damage).toBeCloseTo(160.5);
});
it('Rumble fields are finite, time-prorated and do not spend or gain mana',()=>{
 const q=result('Rumble','cast-q',{duration:1,mana:0});expect(q.damage).toBeCloseTo(305/3);expect(q.resource?.kind).toBe('none');expect(q.stats.mana).toBe(0);
 expect(result('Rumble','cast-q-empowered',{duration:1.5}).damage).toBeCloseTo(228.75);
 expect(result('Rumble','cast-r',{duration:1.5}).damage).toBeCloseTo(232.5);
 expect(result('Rumble','cast-r',{duration:60}).damage).toBeCloseTo(697.5);
});
it('uses the right damage defense for Senna and Zoe without free follow-up damage',()=>{
 expect(result('Senna','cast-r',{armor:100,mr:999}).damage).toBeCloseTo(183);
 expect(result('Zoe','cast-e',{mr:100,armor:999}).damage).toBeCloseTo(57.5);
 expect(result('Zoe','cast-w',{rank:5}).damage).toBe(65);
 expect(result('Senna','cast-q',{rank:5}).damage).toBe(154);
});
it('assigns AD adaptive ties from the raw champion preference',()=>{
 for(const alias of ['Senna','Skarner','Darius'])expect(result(alias,defaultScenario(alias).mode,{extraAD:0,extraAP:0,shards:[5008]}).stats.bonusAD).toBeCloseTo(5.4);
});
it('round-trips existing bleed and shares its condition across build comparisons',()=>{
 const data=catalog as unknown as Catalog,scenario={...defaultScenario('Darius'),mode:'cast-r' as const,abilityStacks:5};
 const save=(abilityStacks:number)=>parseSave(JSON.stringify({version:1,patch:'26.20',scenario:{...scenario,abilityStacks},items:[]}),data.champions,data.items);
 expect(save(5).scenario.abilityStacks).toBe(5);expect(()=>save(6)).toThrow();
 const baseline=comparisonScenario(scenario,{ids:[],names:[]});expect(baseline.abilityStacks).toBe(5);
 const rows=defenseSweep(champion('Darius'),[],[],scenario,baseline,'armor',0,200);expect(rows.length).toBeGreaterThan(0);
});

