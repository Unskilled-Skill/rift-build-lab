import {it,expect} from 'vitest';
import {calculate,defaultScenario,growth} from '../src/engine';
import {readFileSync} from 'node:fs';
import source from '../src/ability-sources.json';
import {abilityModel} from '../src/ability-models';
import {parseSave} from '../src/storage';
import {comparisonScenario} from '../src/workspace-draft';
import {defenseSweep,progressionRows} from '../src/comparison-lab';
import catalog from '../public/data/catalog.json';
import type {Champion,Scenario,Catalog,Item} from '../src/types';
const champion=(alias:string):Champion=>({id:0,alias,name:alias,title:'',roles:[],profile:null,stats:{hp:600,hpperlevel:0,mp:1000,mpperlevel:0,attackdamage:60,attackdamageperlevel:0,armor:30,armorperlevel:4,spellblock:20,spellblockperlevel:2}});
const setup=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>&{extraArmor?:number;extraMR?:number}={})=>({...defaultScenario(alias),mode,level:1,rank:1,mr:0,armor:0,mana:1000,shards:[],runePage:[],extraAP:100,extraAD:40,targetHP:2500,duration:4,...extra});
const result=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>&{extraArmor?:number;extraMR?:number}={},items:Item[]=[])=>calculate(champion(alias),items,setup(alias,mode,extra));
const tank:Item={id:999999,name:'Defense fixture',gold:{total:3000},baseStats:[{name:'Armor',value:100,unit:'flat'},{name:'Magic Resist',value:50,unit:'flat'},{name:'Health',value:1000,unit:'flat'}],descriptionText:'',effectDescriptionText:'',shopListedBySource:true,maps:{'11':true},requiredChampion:null,buildsInto:[],tags:[],iconUrl:''};
it.each([
 ['KSante','cast-q',70,20],['KSante','cast-w',245,45],
 ['Ornn','cast-q',130,45],['Ornn','cast-w',300,45],['Ornn','cast-e',80,35],['Ornn','cast-r',145,100],
 ['Rammus','cast-q',180,60],['Rammus','cast-w',27.61,40],['Rammus','cast-r',210,100],
 ['Udyr','cast-q',224,20],['Udyr','cast-r',220,40],
] as const)('%s %s has independently checked damage and mana cost',(alias,mode,damage,cost)=>{
 expect(abilityModel(alias,mode)).toBeDefined();const r=result(alias,mode);expect(r.damage).toBeCloseTo(damage);expect(r.manaSpent).toBe(cost);
});
it('K Sante scales with bonus defenses, not base defenses or AD/AP',()=>{
 expect(result('KSante','cast-q',{},[tank]).damage).toBeCloseTo(130);
 expect(result('KSante','cast-w',{},[tank]).damage).toBeCloseTo(320);
 expect(result('KSante','cast-q',{extraAD:1000,extraAP:1000}).damage).toBe(70);
 expect(result('KSante','cast-q',{level:18}).damage).toBe(70);
 expect(result('KSante','cast-w',{targetHP:5000},[tank]).damage).toBeCloseTo(595);
 expect(result('KSante','cast-q',{extraArmor:40,extraMR:60}).damage).toBe(110);
});
it('reports own base growth separately from bonus defenses and enemy defenses',()=>{
 const r=result('KSante','cast-q',{level:10,armor:999,mr:888},[tank]);
 expect(r.stats).toMatchObject({bonusArmor:100,bonusMR:50});
 expect(r.stats).toHaveProperty('armor',130+4*growth(10));
});
it('Ornn amplifies bonus HP and defenses using finite earned upgrades before HP conversions',()=>{
 const zero=result('Ornn','cast-e',{},[tank]);expect(zero.damage).toBeCloseTo(146);expect(zero.stats.bonusHP).toBeCloseTo(1100);
 const five=result('Ornn','cast-e',{abilityStacks:5},[tank]);expect(five.damage).toBeCloseTo(158);expect(five.stats.bonusHP).toBeCloseTo(1300);
 expect(result('Ornn','cast-e',{abilityStacks:99},[tank]).damage).toBeCloseTo(158);
 const rift=catalog.items.find(i=>i.id===4633)! as Item;
 const r=result('Ornn','cast-r',{abilityStacks:5,extraHP:1000},[rift]);expect(r.stats.ap).toBeCloseTo(100+rift.baseStats.filter(s=>s.name==='Ability Power').reduce((n,s)=>n+s.value,0)+.02*r.stats.bonusHP);
 expect(result('Ornn','cast-e',{level:18}).damage).toBe(80);
});
it('Rammus W includes its own defensive boost in one retaliation and his resist-to-AD passive',()=>{
 const r=result('Rammus','cast-w');expect(r.stats.armor).toBeCloseTo(74.1);expect(r.stats).toHaveProperty('mr',52);expect(r.stats.bonusAD).toBeCloseTo(40+.15*(74.1+52));
 const rank5=result('Rammus','cast-w',{rank:5});expect(rank5.damage).toBeCloseTo(15+.1*((30+47)*1.6+(20+40)*1.6));
 expect(result('Rammus','cast-q').stats.bonusAD).toBeCloseTo(47.5);
});
it('bounds finite cone/storm damage and supports Udyr rank six without a free second attack',()=>{
 expect(result('Ornn','cast-w',{duration:.375}).damage).toBeCloseTo(150);
 expect(result('Ornn','cast-w',{targetHP:100}).damage).toBe(80);
 expect(result('Udyr','cast-r',{duration:1}).damage).toBe(55);
 expect(result('Udyr','cast-r',{duration:60}).damage).toBe(220);
 expect(result('Udyr','cast-q',{rank:6}).damage).toBe(379);
 expect(result('Udyr','cast-q',{extraHP:1000}).damage).toBe(234);
});
it('round-trips bounded own defenses and Ornn earned count across comparisons',()=>{
 const data=catalog as unknown as Catalog,scenario={...defaultScenario('Ornn'),mode:'cast-e' as const,abilityStacks:5,extraArmor:40,extraMR:60};
 const save=(extra:Record<string,unknown>)=>parseSave(JSON.stringify({version:1,patch:'26.20',scenario:{...scenario,...extra},items:[]}),data.champions,data.items);
 expect(save({}).scenario).toMatchObject({abilityStacks:5,extraArmor:40,extraMR:60});
 for(const extra of [{abilityStacks:6},{extraArmor:-1},{extraMR:10001}])expect(()=>save(extra)).toThrow();
 const base=comparisonScenario(scenario,{ids:[],names:[]});expect(base).toMatchObject({abilityStacks:5,extraArmor:40,extraMR:60});
 const s=setup('KSante','cast-q',{extraArmor:40,extraMR:60}),b=comparisonScenario(s,{ids:[],names:[]});
 expect(defenseSweep(champion('KSante'),[],[],s,b,'armor',0,100).at(-1)!.experiment.damage).toBe(55);
 expect(progressionRows(champion('KSante'),[],[],s,b,[1000,2000]).map(r=>r.experiment.damage)).toEqual([110,110]);
});
it('retains reviewed source snapshots for both intrinsic conversions',()=>{
 const records=source.records as Record<string,Record<string,{path:string;calculations:Record<string,string>;values?:Record<string,number[]>}>>;
 for(const alias of ['Ornn','Rammus']){
  const kit=JSON.parse(readFileSync(new URL(`../public/data/champions/${alias}.json`,import.meta.url),'utf8'));
  const record=records[alias].P,spell=kit.allSpellRecords.find((s:{path:string})=>s.path===record.path);
  expect(spell).toBeTruthy();for(const [key,value] of Object.entries(record.values!))expect(spell.dataValuesRaw[key]).toEqual(value);
  for(const [key,value] of Object.entries(record.calculations))expect(spell.calculations[key].expression).toBe(value);
 }
 expect(records.Ornn.P.values!.BaseStatAmp[0]).toBeCloseTo(.1);expect(records.Ornn.P.values!.AdditionalMythicStatAmp[0]).toBeCloseTo(.04);
 expect(records.Rammus.P.values!.ArmorRatio[0]).toBeCloseTo(.15);expect(records.Rammus.P.values!.MagicResistRatio[0]).toBeCloseTo(.15);
});
it('rejects invalid own defense imports and preserves sixth Udyr ranks',()=>{
 const data=catalog as unknown as Catalog,scenario={...defaultScenario('Udyr'),mode:'cast-q' as const,rank:6};
 const save=(extra:Record<string,unknown>)=>parseSave(JSON.stringify({version:1,patch:'26.20',scenario:{...scenario,...extra},items:[]}),data.champions,data.items);
 expect(save({}).scenario.rank).toBe(6);expect(()=>save({rank:7})).toThrow();
 for(const extra of [{extraArmor:'10'},{extraMR:null},{extraArmor:10001}])expect(()=>save(extra)).toThrow();
});
