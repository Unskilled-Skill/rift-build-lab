import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import source from '../src/ability-sources.json';
import {defenseSweep,progressionRows} from '../src/comparison-lab';
import {calculate,defaultScenario} from '../src/engine';
import {abilityModel,baseCritDamage} from '../src/ability-models';
import {modeledChampions} from '../src/model-support';
import {parseSave} from '../src/storage';
import {comparisonScenario} from '../src/workspace-draft';
import catalog from '../public/data/catalog.json';
import type {Champion,Scenario,Item,Catalog} from '../src/types';
const champion=(alias:string):Champion=>({id:0,alias,name:alias,title:'',roles:[],profile:null,stats:{hp:600,hpperlevel:0,mp:1000,mpperlevel:0,attackdamage:60,attackdamageperlevel:0,armor:30,spellblock:20}});
const setup=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={})=>({...defaultScenario(alias),mode,level:1,rank:1,mr:0,armor:0,mana:1000,shards:[],runePage:[],extraAP:100,extraAD:40,targetHP:2500,duration:4,...extra});
const result=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={},items:Item[]=[])=>calculate(champion(alias),items,setup(alias,mode,extra));
it.each([
 ['Aphelios','cast-r',233,100],['Briar','cast-e',220,0],['Briar','cast-e-empowered',696,0],['DrMundo','cast-q',500,0],
 ['Jhin','cast-q',149.76,40],['Jhin','cast-w',122,50],['Jhin','cast-e',244.8,30],['Jhin','cast-r',90,100],
 ['Nilah','cast-q',100,30],['Nilah','cast-e',68,40],['Olaf','cast-e',120,0],
 ['Pyke','cast-q',130,70],['Pyke','cast-e',140,40],['Rell','cast-q',120,50],['Rell','cast-w',120,40],
 ['Ryze','cast-q',132,40],['Ryze','cast-w',123,50],['Ryze','cast-e',112,40],
 ['Sivir','cast-q',148,55],['Sivir','cast-q-empowered',296,55],['Taric','cast-e',140,40],['Tryndamere','cast-e',200,0],
 ['Vladimir','cast-q',140,0],['Vladimir','cast-q-empowered',259,0],
 ['Zac','cast-q',90,0],['Zac','cast-w',215,0],['Zac','cast-e',140,0],['Zac','cast-r',160,0],['Zac','cast-r-empowered',400,0],
] as const)('%s %s uses independently checked rank-one damage and mana',(alias,mode,damage,cost)=>{
 expect(abilityModel(alias,mode)).toBeDefined();const r=result(alias,mode);expect(r.damage).toBeCloseTo(damage);expect(r.manaSpent).toBe(cost);
});
it('covers every catalog champion with at least one explicit partial objective',()=>{
 expect(modeledChampions.length).toBe(173);expect(new Set(modeledChampions).size).toBe(173);
 for(const c of catalog.champions)expect(modeledChampions).toContain(c.alias);
});
it('models nonlethal health costs separately from mana and before refunds',()=>{
 expect(result('DrMundo','cast-q')).toHaveProperty('healthSpent',50);
 expect(result('DrMundo','cast-q',{healthPercent:1})).toHaveProperty('healthSpent',5);
 expect(result('Olaf','cast-e')).toHaveProperty('healthSpent',48);
 expect(result('Zac','cast-q',{healthPercent:50})).toHaveProperty('healthSpent',24);
 expect(result('Zac','cast-w',{healthPercent:50})).toHaveProperty('healthSpent',12);
 expect(result('Zac','cast-e',{healthPercent:0}).damage).toBe(0);
 expect(result('Zac','cast-r').healthSpent??0).toBe(0);
});
it('Mundo Q uses enemy current HP, with a champion minimum and no monster cap',()=>{
 expect(result('DrMundo','cast-q',{targetHealthPercent:1}).damage).toBe(80);
 expect(result('DrMundo','cast-q',{targetHP:10000}).damage).toBe(2000);
});
it('health from items becomes Pyke AD without HP, Bloodmail HP or Riftmaker HP double-dipping',()=>{
 const r=result('Pyke','cast-q',{extraHP:1400});expect(r.stats.hp).toBe(600);expect(r.stats.bonusHP).toBe(0);expect(r.stats.bonusAD).toBe(140);expect(r.damage).toBe(205);
 const item=catalog.items.find(i=>i.id===2501)! as Item;
 const b=result('Pyke','cast-e',{},[item]);expect(b.stats.bonusHP).toBe(0);expect(b.stats.hp).toBe(600);
});
it('Ryze AP increases maximum and bonus mana, including purchased mana',()=>{
 const r=result('Ryze','cast-q');expect(r.stats.mana).toBeCloseTo(1100);expect(r.stats).toHaveProperty('bonusMana',100);
 const tear:Item={...catalog.items.find(i=>i.id===3075)!,id:99999,baseStats:[{name:'Mana',value:500,unit:'flat'}]};
 const v=result('Ryze','cast-q',{},[tear]);expect(v.stats.mana).toBeCloseTo(1650);expect(v.stats.bonusMana).toBeCloseTo(650);expect(v.damage).toBeCloseTo(143);
});
it('Vladimir conversion excludes feedback between his passive bonuses',()=>{
 const r=result('Vladimir','cast-q',{extraHP:900});expect(r.stats.ap).toBeCloseTo(130);expect(r.stats.bonusHP).toBeCloseTo(1060);expect(r.damage).toBeCloseTo(158);
 const cap=catalog.items.find(i=>i.id===3089)! as Item;
 const v=result('Vladimir','cast-q',{extraHP:900},[cap]);const external=(100+cap.baseStats.find(s=>s.name==='Ability Power')!.value)*1.3;
 expect(v.stats.ap).toBeCloseTo(external+39);expect(v.stats.bonusHP).toBeCloseTo(900+1.6*external);
});
it('Sivir and Nilah spells use continuous crit scaling even in normal attack mode',()=>{
 const ie=catalog.items.find(i=>i.id===3031)! as Item;
 const s=result('Sivir','cast-q',{critMode:'normal'},[ie]);expect(s.damage).toBeCloseTo((60+.7*115+60)*(1+.4*.25*1.3));
 const n=result('Nilah','cast-q',{armor:100},[ie]);expect(n.damage).toBeCloseTo(175*(1+.7*.25*1.3)/1.925);
});
it('Jhin Whisper converts crit and purchased bonus AS into total AD once',()=>{
 const as:Item={...catalog.items.find(i=>i.id===3075)!,id:99998,baseStats:[{name:'Attack Speed',value:100,unit:'percent'},{name:'Critical Strike Chance',value:100,unit:'percent'}]};
 expect(result('Jhin','cast-w',{},[as]).stats.ad).toBeCloseTo(169);
 expect(result('Jhin','cast-w',{level:18}).stats.ad).toBeCloseTo(144);
});
it('Taric Bastion and Tryndamere Bloodlust use explicit learned ranks',()=>{
 expect(result('Taric','cast-e',{traitRank:5,extraArmor:100} as Partial<Scenario>).damage).toBeCloseTo(196.5);
 expect(result('Tryndamere','cast-e',{traitRank:5,healthPercent:10} as Partial<Scenario>).damage).toBeCloseTo(280);
 expect(result('Tryndamere','cast-e',{traitRank:5,healthPercent:100} as Partial<Scenario>).damage).toBe(200);
});
it('earned Aphelios stat ranks affect the initial R but not a free weapon attack',()=>{
 expect(result('Aphelios','cast-r',{abilityStacks:6}).damage).toBeCloseTo(237.8);
 expect(result('Aphelios','cast-r',{abilityStacks:6,apheliosLethalityRanks:6,armor:100} as Partial<Scenario>).damage).toBeCloseTo(237.8/1.73);
});
it('respects charged releases, delayed Dazzle and finite Zac bounces',()=>{
 expect(result('Briar','cast-e',{duration:.5}).damage).toBe(0);
 expect(result('Taric','cast-e',{duration:.5}).damage).toBe(0);
 expect(result('Zac','cast-r-empowered',{duration:.5}).damage).toBe(160);
 expect(result('Zac','cast-r-empowered',{duration:1}).damage).toBe(240);
 expect(result('Zac','cast-r-empowered',{duration:60}).damage).toBe(400);
});
it('persists shared learned ranks and rejects invalid imports',()=>{
 const data=catalog as unknown as Catalog,scenario={...defaultScenario('Taric'),traitRank:5};
 const save=(n:number)=>parseSave(JSON.stringify({version:1,patch:'26.20',scenario:{...scenario,traitRank:n},items:[]}),data.champions,data.items);
 expect(save(5).scenario).toHaveProperty('traitRank',5);for(const n of [-1,6,1.5])expect(()=>save(n)).toThrow();
 expect(comparisonScenario(scenario,{ids:[],names:[]})).toHaveProperty('traitRank',5);
});
it('retains the intrinsic conversion source records and current spell crit multiplier',()=>{
 const records=source.records as Record<string,Record<string,{path:string;calculations:Record<string,string>;values?:Record<string,number[]>}>>;
 for(const alias of ['Aphelios','Jhin','Pyke','Ryze','Vladimir','Rell']){
  const kit=JSON.parse(readFileSync(new URL(`../public/data/champions/${alias}.json`,import.meta.url),'utf8'));
  const r=records[alias].P,spell=kit.allSpellRecords.find((s:{path:string})=>s.path===r.path);expect(spell).toBeTruthy();
  for(const [key,value] of Object.entries(r.calculations))expect(spell.calculations[key].expression).toBe(value);
  for(const [key,value] of Object.entries(r.values||{}))expect(spell.dataValuesRaw[key]).toEqual(value);
 }
 for(const alias of ['Sivir','Nilah']){
  const snapshot=(source.characterStats as Record<string,{sourcePath:string;critDamageMultiplier:number}>)[alias];
  expect(snapshot.sourcePath).toContain(`Characters/${alias}/CharacterRecords/`);expect(snapshot.critDamageMultiplier).toBe(2);expect(baseCritDamage(alias)).toBe(2);
 }
});
it('runs both comparison views for every newly covered champion',()=>{
 for(const alias of ['Aphelios','Briar','DrMundo','Jhin','Nilah','Olaf','Pyke','Rell','Ryze','Sivir','Taric','Tryndamere','Vladimir','Zac']){
  const s=setup(alias,defaultScenario(alias).mode),b=comparisonScenario(s,{ids:[],names:[]});
  const sweep=defenseSweep(champion(alias),[],[],s,b,'mr',0,100);expect(sweep.every(row=>Number.isFinite(row.experiment.damage))).toBe(true);
  const progression=progressionRows(champion(alias),[],[],s,b,[1000,2000]);expect(progression).toHaveLength(2);expect(progression[0].experiment.damage).toBeCloseTo(progression[1].experiment.damage);
 }
});
it('rejects malformed invested ranks and extra AS while retaining old saves',()=>{
 const data=catalog as unknown as Catalog,scenario=defaultScenario('Aphelios');
 const save=(extra:Record<string,unknown>)=>parseSave(JSON.stringify({version:1,patch:'26.20',scenario:{...scenario,...extra},items:[]}),data.champions,data.items);
 expect(save({apheliosLethalityRanks:6}).scenario).toHaveProperty('apheliosLethalityRanks',6);
 for(const x of [{apheliosLethalityRanks:7},{apheliosLethalityRanks:1.5},{extraAS:501},{extraAS:-1},{traitRank:'5'}])expect(()=>save(x)).toThrow();
 expect(save({}).scenario).not.toHaveProperty('traitRank');
});
it('reports the Vladimir Riftmaker cross-conversion gap explicitly',()=>{
 const rift=catalog.items.find(i=>i.id===4633)! as Item;
 expect(result('Vladimir','cast-q',{},[rift]).limitations.join(' ')).toMatch(/cross-conversion.*unverified/);
});
