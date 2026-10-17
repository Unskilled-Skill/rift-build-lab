import {it,expect} from 'vitest';
import {calculate,defaultScenario} from '../src/engine';
import {abilityModels} from '../src/ability-models';
import {objectiveSupport} from '../src/model-support';
import {parseSave} from '../src/storage';
import catalog from '../public/data/catalog.json';
import type {Catalog,Champion,Scenario} from '../src/types';
import {readFileSync} from 'node:fs';
import source from '../src/ability-sources.json';
import {defenseSweep,progressionRows} from '../src/comparison-lab';
const data=catalog as unknown as Catalog;
const champion=(alias:string):Champion=>({id:0,alias,name:alias,title:'',roles:[],profile:null,stats:{hp:600,hpperlevel:0,mp:500,mpperlevel:0,attackdamage:60,attackdamageperlevel:0}});
const s=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={})=>({...defaultScenario(alias),mode,level:1,rank:1,eRank:1,mr:0,armor:0,mana:500,shards:[],runePage:[],extraAP:100,extraAD:40,...extra});
const damage=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={})=>calculate(champion(alias),[],s(alias,mode,extra));
it.each([
 ['Lux','cast-q',155,50],['Lux','cast-e',145,70],['Lux','cast-r',420,100],
 ['Veigar','cast-q',130,30],['Veigar','cast-w',155,60],
 ['Malphite','cast-q',130,70],['Malphite','cast-r',290,100],
 ['Ezreal','cast-q',190,28],['Ezreal','cast-w',210,50],['Ezreal','cast-e',179,70],['Ezreal','cast-r',500,100],
 ['Gragas','cast-q',160,80],['Gragas','cast-q-max',240,80],['Gragas','cast-w',365,30],['Gragas','cast-e',140,50],['Gragas','cast-r',280,100],
 ['Chogath','cast-q',180,50],['Chogath','cast-w',150,70],['Chogath','cast-r',350,100],
 ['Ahri','cast-q',170,55],['Ahri','cast-w',144,30],['Ahri','cast-e',165,60],['Ahri','cast-r',110,100],
 ['Morgana','cast-q',170,50],['Morgana','cast-r',560,100],
 ['Ziggs','cast-q',140,50],['Ziggs','cast-w',120,80],['Ziggs','cast-r',400,100],
 ['Amumu','cast-q',155,50],['Amumu','cast-e',115,35],['Amumu','cast-r',280,100],
 ['Karthus','cast-q',75,20],['Karthus','cast-q-isolated',150,20],['Karthus','cast-r',270,100],
] as const)('%s %s has independently checked rank-one damage and cost',(alias,mode,raw,cost)=>{
 const result=damage(alias,mode);expect(result.damage).toBeCloseTo(raw);expect(result.manaSpent).toBe(cost);
});
it('separates Ahri magic and true packets and only mitigates the outgoing orb',()=>{
 const result=damage('Ahri','cast-q',{mr:100});expect(result.events.map(e=>e.type)).toEqual(['magic','true']);expect(result.damage).toBe(127.5);
});
it('Cho Feast scales with bonus health, not base health, and ignores defenses',()=>{
 const result=damage('Chogath','cast-r',{rank:3,extraHP:1000,mr:1000,armor:1000});expect(result.damage).toBe(800);expect(result.events[0].type).toBe('true');
});
it('Ezreal Q uses total AD, while W uses bonus AD and never grants free trigger damage',()=>{
 expect(damage('Ezreal','cast-q',{extraAD:0,extraAP:0}).damage).toBe(98);expect(damage('Ezreal','cast-w',{extraAD:0,extraAP:0}).damage).toBe(80);
 expect(damage('Ezreal','cast-w').limitations.join(' ')).toMatch(/trigger/i);
});
it('counts Morgana follow-up and Karthus channel only inside the observation window',()=>{
 expect(damage('Morgana','cast-r',{duration:2.99}).damage).toBe(280);expect(damage('Morgana','cast-r',{duration:3}).damage).toBe(560);
 expect(damage('Karthus','cast-r',{duration:2.99}).damage).toBe(0);expect(damage('Karthus','cast-r',{duration:3}).damage).toBe(270);
});
it('Ziggs edge damage is 65% of center and does not borrow Sett grit logic',()=>{
 expect(damage('Ziggs','cast-r',{center:false}).damage).toBe(260);expect(damage('Ziggs','cast-r',{center:true}).damage).toBe(400);
});
it('clamps ultimate ranks separately and uses rank-dependent AP scaling',()=>{
 expect(damage('Lux','cast-r',{rank:5}).damage).toBe(620);expect(damage('Veigar','cast-q',{rank:5}).damage).toBe(310);expect(damage('Ziggs','cast-q',{rank:5}).damage).toBe(360);
});
it('every registered model is selectable, checks positive upfront costs and reports source scope',()=>{
 for(const [alias,models] of Object.entries(abilityModels))for(const [mode,model] of Object.entries(models)){
  expect(objectiveSupport(alias,mode).supported).toBe(true);expect(model.sourcePath).toContain(`Characters/${alias}/Spells/`);
  const result=damage(alias,mode as Scenario['mode'],{mana:0});if(model.cost[0]>0)expect(result.damage).toBe(0);expect(result.resource?.spent).toBe(0);
 }
});
it('new objectives round-trip while incompatible champion casts are rejected',()=>{
 const scenario={...defaultScenario('Lux'),mode:'cast-r' as const,rank:3};const parsed=parseSave(JSON.stringify({version:1,patch:'26.20',scenario,items:[]}),data.champions,data.items);expect(parsed.scenario.mode).toBe('cast-r');
 expect(()=>parseSave(JSON.stringify({version:1,patch:'26.20',scenario:{...scenario,champion:'Garen'},items:[]}),data.champions,data.items)).toThrow();
});
it('keeps source paths, mana costs and reviewed formulas aligned with the bundled champion snapshot',()=>{
 for(const [alias,models] of Object.entries(abilityModels)){
  const kit=JSON.parse(readFileSync(new URL(`../public/data/champions/${alias}.json`,import.meta.url),'utf8'));
  for(const model of Object.values(models)){
   const ability=kit.primaryAbilities.find((a:{slot:string})=>a.slot===model!.slot);
   expect(model!.cost).toEqual(ability.costByRank.map((cost:number)=>cost*(model!.costMultiplier??1)));
   const spell=kit.allSpellRecords.find((r:{path:string})=>r.path===model!.sourcePath);expect(spell).toBeTruthy();
   const records=source.records as Record<string,Record<string,{calculations:Record<string,string>;values?:Record<string,number[]>}>>;
   for(const [key,expression] of Object.entries(records[alias][model!.slot].calculations))expect(spell.calculations[key].expression).toBe(expression);
   for(const [key,values] of Object.entries(records[alias][model!.slot].values||{}))expect(spell.dataValuesRaw[key]).toEqual(values);
  }
 }
});
it('expanded models work through progression and defense comparisons',()=>{
 const cho=champion('Chogath'),scenario=s('Chogath','cast-r',{extraHP:1000});
 const rows=defenseSweep(cho,[],[],scenario,scenario,'mr',0,300);expect(new Set(rows.map(r=>r.experiment.damage)).size).toBe(1);
 const stages=progressionRows(champion('Ezreal'),[],[],s('Ezreal','cast-q'),s('Ezreal','cast-q'),[3000,6000]);expect(stages.map(r=>r.experiment.damage)).toEqual([190,190]);
});
it('Ezreal starts with AD adaptive shards and switches to AP when AP is higher',()=>{
 const initial=damage('Ezreal','cast-q',{extraAD:0,extraAP:0,shards:[5008,5008,5011]});
 expect(initial.stats.bonusAD).toBeCloseTo(10.8);expect(initial.stats.ap).toBe(0);
 const ap=damage('Ezreal','cast-q',{extraAD:0,extraAP:100,shards:[5008,5008,5011]});expect(ap.stats.ap).toBe(118);expect(ap.stats.bonusAD).toBe(0);
});
