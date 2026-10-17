import {it,expect} from 'vitest';
import {calculate,defaultScenario} from '../src/engine';
import {parseSave} from '../src/storage';
import {comparisonScenario} from '../src/workspace-draft';
import {defenseSweep,progressionRows} from '../src/comparison-lab';
import catalog from '../public/data/catalog.json';
import type {Champion,Scenario,Catalog} from '../src/types';
const champion=(alias:string):Champion=>({id:0,alias,name:alias,title:'',roles:[],profile:null,stats:{hp:600,hpperlevel:0,mp:1000,mpperlevel:0,attackdamage:60,attackdamageperlevel:0}});
const setup=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={}):Scenario=>({...defaultScenario(alias),mode,level:1,rank:1,mr:0,armor:0,mana:1000,shards:[],runePage:[],extraAP:100,extraAD:40,targetHP:2500,duration:4,...extra});
const result=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={})=>calculate(champion(alias),[],setup(alias,mode,extra));
it.each([
 ['Aurora','cast-q',85,60],['Aurora','cast-e',150,80],['Aurora','cast-r',245,100],
 ['Bard','cast-q',160,60],
 ['Heimerdinger','cast-w',105,50],['Heimerdinger','cast-w-empowered',193,50],['Heimerdinger','cast-e',120,85],
 ['Hwei','cast-q',205,80],['Hwei','cast-e',135,50],['Hwei','cast-r',325,100],
 ['Nasus','cast-q',130,20],['Nasus','cast-e',198,60],
 ['Nidalee','cast-q',120,50],['Nidalee','cast-q-max',390,50],['Nidalee','cast-w',60,30],
 ['Sona','cast-q',90,50],['Sona','cast-r',200,100],
 ['Swain','cast-q',105,40],['Swain','cast-q-max',210,40],['Swain','cast-w',130,60],['Swain','cast-e',160,50],
 ['Sylas','cast-q',80,55],['Sylas','cast-q-empowered',220,55],['Sylas','cast-w',135,50],['Sylas','cast-e',160,65],
 ['Taliyah','cast-q',105,55],['Taliyah','cast-q-max',273,55],['Taliyah','cast-e',120,90],
 ['Teemo','cast-q',150,70],['Teemo','cast-e',209,0],['Teemo','cast-r',250,75],
 ['Thresh','cast-q',190,70],['Thresh','cast-e',125,60],['Thresh','cast-r',350,100],
 ['TwistedFate','cast-q',165,60],['TwistedFate','cast-e',213,0],
 ['Viktor','cast-q',100,45],['Viktor','cast-e',120,60],['Viktor','cast-r',550,100],
 ['Singed','cast-e',255,60],
 ['Shaco','cast-e',162,75],['Shaco','cast-r',220,100],
 ['Jax','cast-q',105,50],['Jax','cast-w',210,30],['Jax','cast-r',200,100],
 ['Jinx','cast-w',150,40],['Jinx','cast-e',190,90],['Jinx','cast-r',24.8,100],['Jinx','cast-r-empowered',248,100],
 ['Tristana','cast-w',160,30],['Tristana','cast-r',353,100],
 ['Vayne','cast-q',225,30],['Vayne','cast-e',70,90],['Vayne','cast-e-empowered',175,90],
] as const)('%s %s has independently checked rank-one damage and cost',(alias,mode,damage,cost)=>{
 expect(result(alias,mode).damage).toBeCloseTo(damage);expect(result(alias,mode).manaSpent).toBe(cost);
});
it('Nasus adds finite earned Q stacks once without turning them into AD',()=>{
 const r=result('Nasus','cast-q',{abilityStacks:400});expect(r.damage).toBe(530);expect(r.stats.ad).toBe(100);
 expect(result('Nasus','cast-e',{abilityStacks:400}).damage).toBe(198);
 expect(result('Nasus','cast-q',{abilityStacks:-1}).damage).toBe(130);
});
it('shares earned stacks across the baseline, defense sweep and purchase stages',()=>{
 const s=setup('Nasus','cast-q',{abilityStacks:400});const baseline=comparisonScenario(s,{ids:[],names:[]});expect(baseline.abilityStacks).toBe(400);
 const sweep=defenseSweep(champion('Nasus'),[],[],s,baseline,'armor',0,100);expect(sweep[0].experiment.damage).toBe(530);expect(sweep.at(-1)!.experiment.damage).toBe(265);
 expect(progressionRows(champion('Nasus'),[],[],s,baseline,[3000,6000]).map(r=>r.experiment.damage)).toEqual([530,530]);
});
it('retains and validates earned stacks in portable saves and accepts older saves',()=>{
 const data=catalog as unknown as Catalog;const scenario={...defaultScenario('Nasus'),abilityStacks:400};
 const save=(s:Scenario)=>parseSave(JSON.stringify({version:1,patch:'26.20',scenario:s,items:[]}),data.champions,data.items);
 expect(save(scenario).scenario.abilityStacks).toBe(400);expect(save(defaultScenario('Nasus')).scenario.abilityStacks??0).toBe(0);
 for(const invalid of [-1,1.5,1000001,'400',null])expect(()=>save({...scenario,abilityStacks:invalid as number})).toThrow(/abilityStacks/);
});
it('uses missing target HP for Jinx R without scaling the missing-health term by travel',()=>{
 expect(result('Jinx','cast-r',{targetHealthPercent:50}).damage).toBeCloseTo(337.3);
 expect(result('Jinx','cast-r-empowered',{targetHealthPercent:50}).damage).toBeCloseTo(560.5);
 expect(result('Jinx','cast-r-empowered',{targetHealthPercent:50,rank:5}).damage).toBeCloseTo(985.5);
});
it('uses a strict below-30% Shaco E threshold and never assumes Backstab',()=>{
 expect(result('Shaco','cast-e',{targetHealthPercent:30}).damage).toBe(162);
 expect(result('Shaco','cast-e',{targetHealthPercent:29.9}).damage).toBe(243);
 expect(result('Shaco','cast-e').limitations.join(' ')).toMatch(/Backstab.*excluded/i);
});
it('counts Hwei R burn before the three-second detonation and clips it afterwards',()=>{
 expect(result('Hwei','cast-r',{duration:2}).damage).toBe(30);
 expect(result('Hwei','cast-r',{duration:2.99}).damage).toBeCloseTo(44.85);
 expect(result('Hwei','cast-r',{duration:3}).damage).toBe(325);
 expect(result('Hwei','cast-r',{duration:60}).damage).toBe(325);
});
it('uses discrete Viktor storm ticks, not a fractional or unlimited storm',()=>{
 expect(result('Viktor','cast-r',{duration:.99}).damage).toBe(150);
 expect(result('Viktor','cast-r',{duration:1}).damage).toBe(250);
 expect(result('Viktor','cast-r',{duration:6}).damage).toBe(750);
 expect(result('Viktor','cast-r',{duration:60}).damage).toBe(750);
 expect(result('Viktor','cast-r').events.map(e=>e.time)).toEqual([0,1,2,3,4]);
});
it('includes Sylas explosion and Swain eye only after their delays, paying initial mana',()=>{
 expect(result('Sylas','cast-q-empowered',{duration:.59}).damage).toBe(80);
 expect(result('Sylas','cast-q-empowered',{duration:.6}).damage).toBe(220);
 expect(result('Swain','cast-w',{duration:1.49}).damage).toBe(0);
 expect(result('Swain','cast-w',{duration:1.49}).manaSpent).toBe(60);
 expect(result('Swain','cast-w',{duration:1.5}).damage).toBe(130);
});
it('clips Teemo poison, Nidalee trap and Nasus field while counting impact packets once',()=>{
 expect(result('Teemo','cast-e',{duration:2}).damage).toBe(175);
 expect(result('Teemo','cast-r',{duration:2}).damage).toBe(125);
 expect(result('Nidalee','cast-w',{duration:2}).damage).toBe(30);
 expect(result('Nasus','cast-e',{duration:5}).damage).toBe(220);
 expect(result('Nasus','cast-e',{duration:60}).damage).toBe(220);
});
it('uses separate attack delivery defenses and physical AP damage where appropriate',()=>{
 expect(result('Jax','cast-w',{armor:100,mr:0}).damage).toBe(160);
 expect(result('TwistedFate','cast-e',{armor:100,mr:0}).damage).toBe(163);
 expect(result('Teemo','cast-e',{armor:100,mr:0}).damage).toBe(159);
 expect(result('Vayne','cast-q',{armor:100,mr:900}).damage).toBe(112.5);
 expect(result('Vayne','cast-e-empowered',{armor:100}).damage).toBe(87.5);
});
it('uses final rank coefficients and champion-specific adaptive shard preferences',()=>{
 expect(result('Hwei','cast-q',{rank:5}).damage).toBe(425);
 expect(result('Nidalee','cast-q-max',{rank:5}).damage).toBe(650);
 expect(result('Taliyah','cast-q-max',{rank:5}).damage).toBe(455);
 expect(result('Vayne','cast-q',{rank:5}).damage).toBe(265);
 expect(result('Jinx','cast-w',{rank:5}).damage).toBe(350);
 for(const alias of ['Nasus','Thresh','Shaco','Jax','Jinx','Tristana','Vayne']){
  const r=result(alias,defaultScenario(alias).mode,{extraAP:0,extraAD:0,shards:[5008,5008]});expect(r.stats.bonusAD).toBeCloseTo(10.8);expect(r.stats.ap).toBe(0);
 }
 expect(result('TwistedFate','cast-q',{extraAP:0,extraAD:0,shards:[5008,5008]}).stats.ap).toBe(18);
});
