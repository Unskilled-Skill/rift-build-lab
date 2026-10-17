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
 ['Akshan','cast-q',73,60],['Akshan','cast-q-empowered',146,60],
 ['AurelionSol','cast-e',88,90],['AurelionSol','cast-r',225,100],['AurelionSol','cast-r-empowered',281.25,100],
 ['Azir','cast-q',110,70],['Azir','cast-e',130,60],['Azir','cast-r',275,100],
 ['Belveth','cast-q',117,0],['Belveth','cast-w',230,0],['Belveth','cast-r',300,0],
 ['Gnar','cast-q',130,0],['Gnar','cast-w',350,0],['Gnar','cast-e',86,0],
 ['Gwen','cast-q',110,40],['Gwen','cast-q-max',170,40],
 ['Jayce','cast-q',114,40],['Jayce','cast-w',240,40],['Jayce','cast-e',240,55],
 ['Kayn','cast-q',218,40],['Kayn','cast-w',129,40],['Kayn','cast-r',210,100],['Kayn','cast-r-empowered',475,100],
 ['Locke','cast-q',60,70],['Locke','cast-e',80,30],['Locke','cast-r',210,100],
 ['MasterYi','cast-q',90,50],['MasterYi','cast-q-isolated',157.5,50],['MasterYi','cast-e',134,0],
 ['Mel','cast-q',115,70],['Mel','cast-q-max',165,70],['Mel','cast-e',130,50],
 ['Shyvana','cast-w',145,0],['Shyvana','cast-e',235,0],['Shyvana','cast-e-empowered',293.75,0],['Shyvana','cast-r',250,0],
 ['Smolder','cast-w',84,50],['Smolder','cast-r',290,100],['Smolder','cast-r-empowered',435,100],
 ['Urgot','cast-q',95,70],['Urgot','cast-w',32,40],['Urgot','cast-e',130,60],['Urgot','cast-r',120,100],
 ['Viego','cast-w',180,0],
 ['MonkeyKing','cast-e',180,30],['MonkeyKing','cast-r',475,100],
 ['Yunara','cast-q',146,30],['Yunara','cast-w',139,60],
 ['Yuumi','cast-q',80,50],['Yuumi','cast-q-empowered',110,50],['Yuumi','cast-r',100,100],
 ['Zeri','cast-w',180,50],['Zeri','cast-r',284,100],
] as const)('%s %s has independently checked rank-one damage and cost',(alias,mode,damage,cost)=>{
 expect(result(alias,mode).damage).toBeCloseTo(damage);expect(result(alias,mode).manaSpent).toBe(cost);
});
it('Twitch Contaminate requires existing venom and splits the physical and magic packets',()=>{
 const empty=result('Twitch','cast-e');expect(empty.damage).toBe(0);expect(empty.manaSpent).toBe(0);
 expect(result('Twitch','cast-e',{abilityStacks:1}).damage).toBe(84);
 const six=result('Twitch','cast-e',{abilityStacks:6});expect(six.damage).toBe(404);expect(six.manaSpent).toBe(50);
 expect(six.events.map(e=>e.type)).toEqual(['physical','magic']);expect(six.events[0].raw).toBeCloseTo(194);expect(six.events[1].raw).toBeCloseTo(210);
 expect(result('Twitch','cast-e',{abilityStacks:6,armor:100}).damage).toBe(307);
 expect(result('Twitch','cast-e',{abilityStacks:6,mr:100}).damage).toBe(299);
 expect(result('Twitch','cast-e',{abilityStacks:100}).damage).toBe(404);
 expect(result('Twitch','cast-e',{abilityStacks:6,rank:5}).damage).toBe(564);
});
it('Mel R requires a marked target and counts existing Overwhelm stacks without awarding an execute',()=>{
 expect(result('Mel','cast-r').damage).toBe(0);expect(result('Mel','cast-r').manaSpent).toBe(0);
 const three=result('Mel','cast-r',{abilityStacks:3});expect(three.damage).toBe(179);expect(three.manaSpent).toBe(100);
 expect(three.limitations.join(' ')).toMatch(/execution.*excluded/i);
 expect(result('Mel','cast-r',{abilityStacks:3,rank:5}).damage).toBe(347);
});
it('supports sixth learned ranks in the model and portable saves for Yuumi and Jayce',()=>{
 expect(result('Yuumi','cast-q',{rank:6}).damage).toBe(255);expect(result('Yuumi','cast-q',{rank:6}).manaSpent).toBe(75);
 expect(result('Yuumi','cast-q-empowered',{rank:6}).damage).toBe(385);
 expect(result('Jayce','cast-q',{rank:6}).damage).toBe(364);
 expect(result('Jayce','cast-w',{rank:6}).damage).toBe(540);
 expect(result('Jayce','cast-e',{rank:6}).damage).toBe(590);
 const data=catalog as unknown as Catalog,scenario={...defaultScenario('Yuumi'),rank:6};
 expect(parseSave(JSON.stringify({version:1,patch:'26.20',scenario,items:[]}),data.champions,data.items).scenario.rank).toBe(6);
 expect(()=>parseSave(JSON.stringify({version:1,patch:'26.20',scenario:{...scenario,rank:7},items:[]}),data.champions,data.items)).toThrow();
});
it('prorates finite fields and whirlwind channels without free duration extensions',()=>{
 expect(result('AurelionSol','cast-e',{duration:2}).damage).toBe(44);
 expect(result('AurelionSol','cast-e',{duration:60}).damage).toBe(110);
 expect(result('Jayce','cast-w',{duration:2}).damage).toBe(120);
 expect(result('Jayce','cast-w',{duration:60}).damage).toBe(240);
 expect(result('MonkeyKing','cast-r',{duration:1}).damage).toBeCloseTo(237.5);
 expect(result('MonkeyKing','cast-r',{duration:60}).damage).toBeCloseTo(475);
});
it('BelVeth R uses enemy missing health as true damage and does not borrow item amplification',()=>{
 expect(result('Belveth','cast-r',{targetHealthPercent:50,armor:1000,mr:1000}).damage).toBe(550);
 const rift=catalog.items.find(i=>i.id===4633)! as Item;
 const r=result('Belveth','cast-r',{targetHealthPercent:50,combatSeconds:10},[rift]);
 expect(r.damage).toBe(150+1.5*r.stats.ap+250);expect(r.events[0].type).toBe('true');
});
it('keeps guaranteed delivery packets separate from magic/true bonuses',()=>{
 expect(result('Gnar','cast-w',{armor:100}).damage).toBe(300);
 expect(result('Gnar','cast-e',{extraHP:1000}).damage).toBe(146);
 expect(result('MasterYi','cast-e',{armor:100,mr:1000}).damage).toBe(84);
 expect(result('Yunara','cast-q',{armor:100}).damage).toBe(96);
 expect(result('Gwen','cast-q-max',{mr:100}).damage).toBe(85);
 expect(result('Zeri','cast-w',{armor:100,mr:1000}).damage).toBe(90);
});
it('does not turn non-mana resource purchases into mana or Muramana conversion',()=>{
 const mura=catalog.items.find(i=>i.id===3042)! as Item;
 for(const alias of ['Belveth','Gnar','Shyvana','Viego']){
  const r=result(alias,defaultScenario(alias).mode,{mana:0},[mura]);expect(r.resource?.kind).toBe('none');expect(r.stats.mana).toBe(0);expect(r.manaSpent).toBe(0);expect(r.stats.bonusAD).toBe(40+mura.baseStats.filter(s=>s.name==='Attack Damage').reduce((n,s)=>n+s.value,0));expect(r.damage).toBeGreaterThan(0);
 }
});
it('preserves bounded venom/Overwhelm inputs and shares them through all comparisons',()=>{
 const data=catalog as unknown as Catalog,scenario={...defaultScenario('Twitch'),mode:'cast-e' as const,abilityStacks:6};
 const save=(s:Scenario)=>parseSave(JSON.stringify({version:1,patch:'26.20',scenario:s,items:[]}),data.champions,data.items);
 expect(save(scenario).scenario.abilityStacks).toBe(6);expect(()=>save({...scenario,abilityStacks:7})).toThrow(/abilityStacks/);
 const s=setup('Twitch','cast-e',{abilityStacks:6}),base=comparisonScenario(s,{ids:[],names:[]});expect(base.abilityStacks).toBe(6);
 const rows=defenseSweep(champion('Twitch'),[],[],s,base,'mr',0,100);expect(rows[0].experiment.damage).toBe(404);expect(rows.at(-1)!.experiment.damage).toBe(299);
 expect(progressionRows(champion('Twitch'),[],[],s,base,[3000,6000]).map(r=>r.experiment.damage)).toEqual([404,404]);
});
