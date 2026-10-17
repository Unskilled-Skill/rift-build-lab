import {it,expect} from 'vitest';
import {calculate,defaultScenario} from '../src/engine';
import catalog from '../public/data/catalog.json';
import {defenseSweep,progressionRows} from '../src/comparison-lab';
import {parseSave} from '../src/storage';
import type {Champion,Scenario,Item,Catalog} from '../src/types';
const champion=(alias:string):Champion=>({id:0,alias,name:alias,title:'',roles:[],profile:null,stats:{hp:600,hpperlevel:0,mp:1000,mpperlevel:0,attackdamage:60,attackdamageperlevel:0}});
const setup=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={}):Scenario=>({...defaultScenario(alias),mode,level:1,rank:1,mr:0,armor:0,mana:1000,shards:[],runePage:[],extraAP:100,extraAD:40,targetHP:2500,duration:4,...extra});
const result=(alias:string,mode:Scenario['mode'],extra:Partial<Scenario>={},items:Item[]=[])=>calculate(champion(alias),items,setup(alias,mode,extra));
it.each([
 ['Ekko','cast-q',220,40],['Ekko','cast-e',190,40],['Ekko','cast-r',375,100],
 ['Elise','cast-q',215,80],['Elise','cast-w',135,60],
 ['Evelynn','cast-q',50,40],['Evelynn','cast-e',172.5,40],['Evelynn','cast-e-empowered',242.5,40],['Evelynn','cast-r',200,100],
 ['Ivern','cast-q',150,60],['Ivern','cast-e',150,70],
 ['Kassadin','cast-q',145,60],['Kassadin','cast-e',140,60],['Kassadin','cast-r',150,40],['Kassadin','cast-r-empowered',358,640],
 ['Khazix','cast-q',122,20],['Khazix','cast-q-isolated',256.2,20],['Khazix','cast-w',115,55],['Khazix','cast-e',81,50],
 ['Lillia','cast-q',140,65],['Lillia','cast-w',115,50],['Lillia','cast-w-empowered',345,50],['Lillia','cast-e',110,70],
 ['Lulu','cast-q',110,50],['Lulu','cast-q-empowered',165,50],['Lulu','cast-e',120,60],
 ['Malzahar','cast-q',125,60],['Malzahar','cast-e',160,60],
 ['Milio','cast-q',200,50],
 ['Rakan','cast-q',140,45],['Rakan','cast-w',150,50],['Rakan','cast-r',150,100],
 ['Renata','cast-q',160,80],['Renata','cast-e',120,70],
 ['Soraka','cast-q',120,45],['Soraka','cast-e',220,70],
 ['Zilean','cast-q',165,60],
 ['Zyra','cast-q',125,55],['Zyra','cast-e',120,70],['Zyra','cast-r',270,100],
] as const)('%s %s independently checked rank-one damage and cost',(alias,mode,damage,cost)=>{
 expect(result(alias,mode).damage).toBeCloseTo(damage);expect(result(alias,mode).manaSpent).toBe(cost);
});
it('uses enemy current HP for Elise and a strict below-30% threshold for Evelynn',()=>{
 // 40 + (4% + 3% from 100 AP) * 1250 current HP.
 expect(result('Elise','cast-q',{targetHealthPercent:50}).damage).toBeCloseTo(127.5);
 expect(result('Evelynn','cast-r',{targetHealthPercent:30}).damage).toBe(200);
 expect(result('Evelynn','cast-r',{targetHealthPercent:29.99}).damage).toBe(480);
 expect(result('Evelynn','cast-e',{targetHealthPercent:10}).damage).toBe(172.5);
});
it('requires the entire prepared Kassadin R cost and scales from maximum rather than available mana',()=>{
 expect(result('Kassadin','cast-r-empowered',{mana:639}).damage).toBe(0);
 const ready=result('Kassadin','cast-r-empowered',{mana:640});expect(ready.damage).toBe(358);expect(ready.resource?.spent).toBe(640);
 expect(result('Kassadin','cast-r',{mana:40}).damage).toBe(150);
 expect(result('Kassadin','cast-r-empowered').limitations.join(' ')).toMatch(/four.*already|already.*four/i);
});
it('separates Lillia outer-edge true damage and Ekko attack delivery defenses',()=>{
 expect(result('Lillia','cast-q',{mr:100}).damage).toBe(105);
 expect(result('Lillia','cast-q',{mr:100}).events.map(e=>e.type)).toEqual(['magic','true']);
 expect(result('Ekko','cast-e',{armor:100,mr:0}).damage).toBe(140);
});
it('respects Ivern, Soraka and Zilean delays without refunding initial mana',()=>{
 expect(result('Ivern','cast-e',{duration:1.99}).damage).toBe(0);
 expect(result('Ivern','cast-e',{duration:2}).damage).toBe(150);
 expect(result('Soraka','cast-e',{duration:1.49}).damage).toBe(110);
 expect(result('Soraka','cast-e',{duration:1.5}).damage).toBe(220);
 expect(result('Zilean','cast-q',{duration:2.99}).damage).toBe(0);
 expect(result('Zilean','cast-q',{duration:2.99}).manaSpent).toBe(60);
});
it('prorates Malzahar E inside its four-second window and pays mana even at zero observation time',()=>{
 expect(result('Malzahar','cast-e',{duration:2}).damage).toBe(80);
 expect(result('Malzahar','cast-e',{duration:10}).damage).toBe(160);
 expect(result('Malzahar','cast-e',{duration:0}).damage).toBe(0);
 expect(result('Malzahar','cast-e',{duration:0}).manaSpent).toBe(60);
});
it('integrates Malzahar E across fractional Riftmaker ramp boundaries',()=>{
 const rift=catalog.items.find(i=>i.id===4633)! as Item;
 const full=result('Malzahar','cast-e',{duration:4,combatSeconds:.5},[rift]);
 const perSecond=(80+.8*full.stats.ap)/4;
 expect(full.damage).toBeCloseTo(perSecond*(.5+1.02+1.04+1.06+.5*1.08));
 const half=result('Malzahar','cast-e',{duration:.75,combatSeconds:.5},[rift]);
 expect(half.damage).toBeCloseTo(perSecond*(.5+.25*1.02));
});
it('new damage variants also work in purchase and defense comparisons',()=>{
 const s=setup('Lillia','cast-q');const rows=defenseSweep(champion('Lillia'),[],[],s,s,'mr',0,100);
 expect(rows[0].experiment.damage).toBe(140);expect(rows.at(-1)!.experiment.damage).toBe(105);
 const k=setup('Kassadin','cast-r-empowered');expect(progressionRows(champion('Kassadin'),[],[],k,k,[3000,6000]).map(r=>r.experiment.damage)).toEqual([358,358]);
});
it('uses final learned rank values and clamps ultimates to rank three',()=>{
 expect(result('Ekko','cast-q',{rank:5}).damage).toBe(380);
 expect(result('Elise','cast-q',{rank:5}).damage).toBeCloseTo(335);
 expect(result('Kassadin','cast-r-empowered',{rank:5}).damage).toBe(468);
 expect(result('Lulu','cast-q-empowered',{rank:5}).damage).toBe(375);
 expect(result('Lillia','cast-w-empowered',{rank:5}).damage).toBe(585);
 expect(result('Zyra','cast-r',{rank:5}).damage).toBe(470);
});
it('retains prepared variants and target conditions in portable saves',()=>{
 const data=catalog as unknown as Catalog;
 for(const [alias,mode] of [['Kassadin','cast-r-empowered'],['Lillia','cast-w-empowered'],['Lulu','cast-q-empowered'],['Evelynn','cast-e-empowered']] as const){
  const scenario=setup(alias,mode,{targetHealthPercent:29,mana:640,shards:[5008,5008,5001],runePage:defaultScenario(alias).runePage});
  const restored=parseSave(JSON.stringify({version:1,patch:'26.20',scenario,items:[]}),data.champions,data.items);
  expect(restored.scenario.mode).toBe(mode);expect(restored.scenario.targetHealthPercent).toBe(29);
 }
});
it('starts KhaZix with AD adaptive shards and switches to AP when AP is higher',()=>{
 const ad=result('Khazix','cast-q',{extraAD:0,extraAP:0,shards:[5008,5008]});
 expect(ad.stats.bonusAD).toBeCloseTo(10.8);expect(ad.stats.ap).toBe(0);
 const ap=result('Khazix','cast-q',{extraAD:0,extraAP:100,shards:[5008,5008]});expect(ap.stats.ap).toBe(118);
});
