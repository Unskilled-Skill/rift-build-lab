import {it,expect} from 'vitest';
import {calculate,defaultScenario} from '../src/engine';
import source from '../src/ability-sources.json';
import {abilityModel,penetrationRules} from '../src/ability-models';
import {parseSave} from '../src/storage';
import {comparisonScenario} from '../src/workspace-draft';
import {defenseSweep,progressionRows} from '../src/comparison-lab';
import catalog from '../public/data/catalog.json';
import type {Champion,Scenario,Catalog,Item} from '../src/types';
const champion=(alias:string):Champion=>({id:0,alias,name:alias,title:'',roles:[],profile:null,stats:{hp:600,hpperlevel:0,mp:1000,mpperlevel:0,attackdamage:60,attackdamageperlevel:0}});
const setup=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>&{penetrationRank?:number}={})=>({...defaultScenario(alias),mode,level:1,rank:1,mr:0,armor:0,mana:1000,shards:[],runePage:[],extraAP:100,extraAD:40,targetHP:2500,duration:4,...extra});
const result=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>&{penetrationRank?:number}={},items:Item[]=[])=>calculate(champion(alias),items,setup(alias,mode,extra));
it.each([
 ['Annie','cast-q',160,60],['Annie','cast-w',150,70],['Annie','cast-e',65,60],['Annie','cast-r',225,100],
 ['Mordekaiser','cast-e',105,0],
 ['Ambessa','cast-w',70,0],['Ambessa','cast-w-empowered',105,0],['Ambessa','cast-e',60,0],['Ambessa','cast-r',182,0],
 ['Zaahen','cast-w',60,50],['Zaahen','cast-e',60,40],['Zaahen','cast-e-empowered',190,40],['Zaahen','cast-r',330,100],
 ['Hecarim','cast-w',160,50],['Hecarim','cast-r',250,100],
 ['Rengar','cast-w',130,0],['Rengar','cast-e',87,0],
] as const)('%s %s has independently checked rank-one damage and cost',(alias,mode,damage,cost)=>{
 expect(abilityModel(alias,mode)).toBeDefined();const r=result(alias,mode);expect(r.damage).toBeCloseTo(damage);expect(r.manaSpent).toBe(cost);
});
it('uses learned R penetration for Annie Q and automatically uses selected R rank for R itself',()=>{
 expect(result('Annie','cast-q',{mr:100}).damage).toBeCloseTo(80);
 expect(result('Annie','cast-q',{mr:100,penetrationRank:3}).damage).toBeCloseTo(160/1.8);
 expect(result('Annie','cast-r',{mr:100,penetrationRank:0}).damage).toBeCloseTo(225/1.9);
 expect(result('Annie','cast-r',{mr:100,rank:3,penetrationRank:1}).damage).toBeCloseTo(475/1.8);
});
it('applies Mordekaiser E penetration from its own cast rank without charging mana',()=>{
 const r=result('Mordekaiser','cast-e',{mr:100,rank:5,mana:0});expect(r.damage).toBeCloseTo(185/1.85);expect(r.stats.percentPen).toBeCloseTo(.15);expect(r.resource?.kind).toBe('none');
});
it('combines item and learned penetration multiplicatively, then flat penetration, preserving negative resistance',()=>{
 const pen:Item={id:999999,name:'Test penetration',gold:{total:0},baseStats:[{name:'Magic Penetration',value:40,unit:'percent'},{name:'Magic Penetration',value:10,unit:'flat'}],descriptionText:'',effectDescriptionText:'',shopListedBySource:true,maps:{'11':true},requiredChampion:null,buildsInto:[],tags:[],iconUrl:''};
 const r=result('Annie','cast-q',{mr:100,penetrationRank:3},[pen]);expect(r.stats.percentPen).toBeCloseTo(.52);expect(r.damage).toBeCloseTo(160/1.38);
 expect(result('Annie','cast-q',{mr:-100,penetrationRank:3},[pen]).damage).toBeCloseTo(240);
});
it('physical learned penetration stacks with item armor penetration and never penetrates the magic E packet',()=>{
 const pen:Item={id:999998,name:'Test armor pen',gold:{total:0},baseStats:[{name:'Armor Penetration',value:30,unit:'percent'}],descriptionText:'',effectDescriptionText:'',shopListedBySource:true,maps:{'11':true},requiredChampion:null,buildsInto:[],tags:[],iconUrl:''};
 expect(result('Ambessa','cast-e',{armor:100,penetrationRank:3},[pen]).damage).toBeCloseTo(60/1.49);
 const z=result('Zaahen','cast-e-empowered',{armor:100,mr:100,penetrationRank:3});expect(z.events.map(e=>e.type)).toEqual(['physical','magic']);expect(z.damage).toBeCloseTo(90/1.7+100/2);
});
it('models Ambessa energy as a 200-cap resource and does not give mana from items',()=>{
 expect(result('Ambessa','cast-w',{mana:69}).damage).toBe(0);
 const r=result('Ambessa','cast-w',{mana:70});expect(r.damage).toBe(70);expect(r.resource).toEqual({kind:'energy',maximum:200,spent:70});expect(r.stats.mana).toBe(0);
 expect(result('Ambessa','cast-r',{mana:0}).damage).toBe(182);
});
it('prorates one Hecarim W without additional casts or free on-hits',()=>{
 expect(result('Hecarim','cast-w',{duration:1}).damage).toBe(40);
 expect(result('Hecarim','cast-w',{duration:60}).damage).toBe(160);
 expect(result('Rengar','cast-e',{rank:5}).damage).toBe(267);
 expect(result('Annie','cast-e').limitations.join(' ')).toMatch(/one.*retaliation/i);
});
it('preserves a bounded integer learned rank in portable saves and shared comparisons',()=>{
 const data=catalog as unknown as Catalog,scenario={...defaultScenario('Annie'),mode:'cast-q' as const,penetrationRank:3};
 const save=(rank:number)=>parseSave(JSON.stringify({version:1,patch:'26.20',scenario:{...scenario,penetrationRank:rank},items:[]}),data.champions,data.items);
 expect(save(3).scenario).toHaveProperty('penetrationRank',3);
 for(const n of [-1,4,1.5])expect(()=>save(n)).toThrow(/penetrationRank/);
 const base=comparisonScenario(scenario,{ids:[],names:[]});expect(base).toHaveProperty('penetrationRank',3);
 const s=setup('Annie','cast-q',{penetrationRank:3}),b=comparisonScenario(s,{ids:[],names:[]});
 const rows=defenseSweep(champion('Annie'),[],[],s,b,'mr',0,100);expect(rows.at(-1)!.experiment.damage).toBeCloseTo(160/1.8);
 expect(progressionRows(champion('Annie'),[],[],s,b,[1000,2000]).map(r=>r.experiment.damage)).toEqual([160,160]);
});
it('keeps learned passive penetration aligned with the reviewed source rank values',()=>{
 const rows=[['Annie','R','RPercentPenBuff'],['Mordekaiser','E','MagicPen'],['Ambessa','R','Armor_Penetration'],['Zaahen','R','ArmorPen']] as const;
 const records=source.records as Record<string,Record<string,{values?:Record<string,number[]>}>>;
 for(const [alias,slot,key] of rows){const rule=penetrationRules[alias];expect(rule.slot).toBe(slot);for(let i=0;i<rule.values.length;i++)expect(rule.values[i]).toBeCloseTo(records[alias][slot].values![key][i+1]);}
});
it('does not turn Rengar mana purchases into Ferocity or Muramana AD',()=>{
 const mura=catalog.items.find(i=>i.id===3042)! as Item;
 const r=result('Rengar','cast-e',{mana:0},[mura]);expect(r.resource?.kind).toBe('none');expect(r.stats.mana).toBe(0);
 expect(r.stats.bonusAD).toBe(40+mura.baseStats.filter(s=>s.name==='Attack Damage').reduce((sum,s)=>sum+s.value,0));
});
