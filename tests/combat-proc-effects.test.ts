import {describe,it,expect} from 'vitest';
import {createProcEffects,type ProcHit} from '../src/combat-proc-effects';
import {defaultScenario} from '../src/scenario';
import type {Champion,Item,Result,Scenario} from '../src/types';
import catalog from '../public/data/catalog.json';
import evidence from '../scripts/combat-source-evidence.json';

const champion:Champion={id:69,alias:'Cassiopeia',name:'Cassiopeia',title:'',roles:[],stats:{},profile:null};
const stats:Result['stats']={ap:200,bonusAD:50,baseAD:100,ad:150,critChance:.5,critDamage:2,bonusAS:0,bonusMana:0,armor:0,bonusArmor:0,mr:0,bonusMR:0,hp:2000,bonusHP:1000,haste:0,mana:1000,flatPen:0,percentPen:0};
const hit=(extra:Partial<ProcHit>={}):ProcHit=>({time:0,type:'magic',raw:100,damage:50,kind:'ability',aoe:false,targetHealthPercent:100,...extra});
const scenario=(runePage:number[],extra:Partial<Scenario>={}):Scenario=>({...defaultScenario(),duration:60,runePage,effects:{runeProcsReady:true,itemProcsReady:true},...extra});
const item=(id:number)=>({...catalog.items.find(i=>i.id===id)!}) as Item;
const procs=(runes:number[],items:Item[]=[],extra:Partial<Scenario>={})=>createProcEffects(champion,items,scenario(runes,extra),stats);
const total=(packets:ReturnType<ReturnType<typeof createProcEffects>['onHit']>)=>packets.reduce((sum,p)=>sum+p.raw,0);

describe('source-supported separate rune and item damage packets',()=>{
 it('locks the current coefficients to the source snapshot rather than old rune versions',()=>{
  const raw=(id:number)=>catalog.runes.find(r=>r.id===id)!.effectValuesRaw as unknown as Record<string,number>;
  expect(raw(8229)).toMatchObject({DamageBase:15,DamageMax:100,MaxRange:750,MaxDamageAmp:1});
  expect(raw(8214)).toMatchObject({DamageBase:10,DamageMax:50});
  expect(raw(8237)).toMatchObject({Damage:20,DamageMax:40,BurnlockoutDuration:10,DotDuration:1});
  expect(raw(8369).DamageAmp).toBeCloseTo(.07);
  expect(raw(8992)).toMatchObject({Duration:4,AoEDuration:2,DotDuration:1,TicksPerSecond:2,TimeToAmp:3});
  expect(raw(8128)).toMatchObject({BaseDamage:30,DamagePerSoulEssence:11,Cooldown:35});
  expect(item(6653).effectDescriptionText).toContain('2% max Health magic damage per second for 3 seconds');
  expect(item(3094).effectDescriptionText).toContain('40 bonus magic damage');
 });
 it('adds no passive proc damage without explicit readiness',()=>{
  const p=procs([8229,8214,8237,8992,8128,9923],[item(6653),item(3078)],{effects:{}});
  expect(p.onHit(hit({targetHealthPercent:20}))).toEqual([]);
  expect(p.onHit(hit({kind:'attack',time:1}))).toEqual([]);
 });
 it('keeps Comet adaptive and respects level scaling, distance, cooldown and misses',()=>{
  const p=procs([8229],[],{level:1,effects:{runeProcsReady:true,cometDistance:750}});
  expect(p.onHit(hit())).toEqual([{time:0,name:'Arcane Comet',type:'magic',raw:60,origin:'rune'}]);
  expect(p.onHit(hit({time:19}))).toEqual([]);expect(total(p.onHit(hit({time:20})))).toBe(60);
  expect(procs([8229],[],{effects:{runeProcsReady:true,cometHit:false}}).onHit(hit())).toEqual([]);
 });
 it('does not use true native damage to turn adaptive Comet into a true proc',()=>{
  expect(procs([8229]).onHit(hit({type:'true'}))[0].type).toBe('magic');
  const p=createProcEffects(champion,[],scenario([8229]),{...stats,ap:0,bonusAD:200});
  expect(p.onHit(hit())[0]).toMatchObject({type:'physical',raw:120});
 });
 it('sends Aery once for actual native damage without inventing return travel',()=>{
  const p=procs([8214]);expect(total(p.onHit(hit({kind:'attack'})))).toBe(65);
  expect(p.onHit(hit({time:15}))).toEqual([]);
 });
 it('Scorch requires a spell and its delayed hit fits the observation window',()=>{
  expect(procs([8237]).onHit(hit({kind:'attack'}))).toEqual([]);
  expect(procs([8237],[],{duration:.5}).onHit(hit())).toEqual([]);
  const p=procs([8237]);expect(p.onHit(hit())).toEqual([{time:1,name:'Scorch',type:'magic',raw:40,origin:'rune'}]);
  expect(p.onHit(hit({time:9.99}))).toEqual([]);expect(p.onHit(hit({time:10}))[0].time).toBe(11);
 });
 it('First Strike uses post-mitigation damage once, includes true native hits, and ends at three seconds',()=>{
  const p=procs([8369],[],{firstStrikeReady:true,effects:{}});
  expect(p.onHit(hit({raw:1000,damage:100,type:'true'}))).toEqual([{time:0,name:'First Strike',type:'true',raw:7.000000000000001,origin:'rune',amplification:'none'}]);
  expect(total(p.onHit(hit({time:2.99,damage:50})))).toBeCloseTo(3.5);
  expect(p.onHit(hit({time:3}))).toEqual([]);expect(p.onHit(hit({time:30}))).toEqual([]);
  expect(procs([8369]).onHit(hit())).toEqual([]);
 });
 it('Dark Harvest gates below 50%, uses pre-earned souls and enforces its cooldown',()=>{
  const p=procs([8128],[],{effects:{runeProcsReady:true,darkHarvestStacks:4}});
  expect(p.onHit(hit({targetHealthPercent:50}))).toEqual([]);
  expect(total(p.onHit(hit({targetHealthPercent:49})))).toBe(89);
  expect(p.onHit(hit({time:34,targetHealthPercent:1}))).toEqual([]);
  expect(total(p.onHit(hit({time:35,targetHealthPercent:1})))).toBe(100);
 });
 it('Hail counts actual attacks only and cannot resume an expired three-attack window',()=>{
  const p=procs([9923]);expect(p.onHit(hit())).toEqual([]);
  expect(total(p.onHit(hit({kind:'attack'})))).toBe(46);
  expect(p.onHit(hit({kind:'on-hit',time:.1}))).toEqual([]);
  expect(total(p.onHit(hit({kind:'attack',time:1})))).toBe(46);
  expect(p.onHit(hit({kind:'attack',time:5}))).toEqual([]);
  expect(p.onHit(hit({kind:'attack',time:6}))).toEqual([]);
  expect(total(p.onHit(hit({kind:'attack',time:10})))).toBe(46);
 });
 it('Spellblade consumes one explicitly armed attack; one cast cannot re-arm it through repeated ticks',()=>{
  const p=procs([],[item(3078)],{spellbladeReady:true});
  expect(p.onHit(hit())).toEqual([]);expect(total(p.onHit(hit({kind:'attack',time:1})))).toBe(200);
  expect(p.onHit(hit({kind:'on-hit',time:2}))).toEqual([]);
  expect(p.onHit(hit({kind:'attack',time:20}))).toEqual([]);
  expect(total(procs([],[item(3508)],{spellbladeReady:true}).onHit(hit({kind:'on-hit'})))).toBe(150);
 });
 it('Liandry refreshes a single burn and integrates partial tails without stacking or over-running the horizon',()=>{
  const p=procs([],[item(6653)],{duration:4,targetHP:1000});
  const a=p.onHit(hit()),b=p.onHit(hit({time:.5})),c=p.onHit(hit({time:1})),d=p.onHit(hit({time:1}));
  expect(total(a)).toBe(60);expect(total(b)).toBe(10);expect(total(c)).toBe(10);expect(d).toEqual([]);
  expect([...a,...b,...c].every(x=>x.time<=4&&x.origin==='item')).toBe(true);
  expect(procs([],[item(6653)]).onHit(hit({kind:'attack'}))).toEqual([]);
 });
 it('Deathfire uses verified classifications and amplifies only time beyond three continuous seconds',()=>{
  expect(total(procs([8992]).onHit(hit()))).toBeCloseTo(20.5*4.75);
  expect(total(procs([8992]).onHit(hit({aoe:true})))).toBeCloseTo(41);
  expect(total(procs([8992]).onHit(hit({periodic:true})))).toBeCloseTo(20.5);
  expect(total(procs([8992]).onHit(hit({aoe:undefined})))).toBeCloseTo(20.5);
  const p=procs([8992],[],{duration:5});const a=p.onHit(hit({periodic:true}));
  const b=p.onHit(hit({time:1,periodic:true})),c=p.onHit(hit({time:2,periodic:true})),d=p.onHit(hit({time:3,periodic:true}));
  expect(total([...a,...b,...c,...d])).toBeCloseTo(20.5*4.75);
 });
 it('locks current item coefficients to extracted 26.20 calculation records',()=>{
  expect(evidence.version).toBe('16.20');
  expect(evidence.items['3115'].values.NashorsBaseValue).toBe(15);
  expect(evidence.items['3115'].values.NashorsAPValue).toBeCloseTo(.15);
  expect(evidence.items['3100'].values.SpellbladeADRatio).toBe(.75);
  expect(evidence.items['3100'].values.LichBaneAPValue).toBeCloseTo(.45);
  expect(evidence.items['3100'].values.SpellbladeCooldown).toBe(1.5);
  expect(evidence.items['3078'].values.SpellbladeMultiplier).toBe(2);
  expect(evidence.items['3508'].values).toMatchObject({BaseADRatio:1.25,CritChanceMultiplier:50,SpellbladeCooldown:1.5});
  expect(evidence.items['6655'].values).toMatchObject({BaseDamage:75,MaxCharges:6,Cooldown:12});
  expect(evidence.items['6655'].values.APRatio).toBeCloseTo(.05);
  expect(evidence.items['6655'].values.RepeatDamageReduction).toBeCloseTo(.2);
 });
 it('Nashor procs on actual on-hit deliveries without granting hits to ordinary spell packets',()=>{
  const p=procs([],[item(3115)]);
  expect(p.onHit(hit())).toEqual([]);
  expect(total(p.onHit(hit({kind:'attack'})))).toBe(45);
  expect(total(p.onHit(hit({kind:'on-hit',spellEffects:true,appliesOnHit:true,time:1})))).toBe(45);
  expect(p.onHit(hit({kind:'on-hit',spellEffects:false,appliesOnHit:false,time:2}))).toEqual([]);
 });
 it('Lich Bane uses current base AD and AP coefficients and consumes only one armed delivery',()=>{
  const p=procs([],[item(3100)],{spellbladeReady:true});
  expect(p.onHit(hit())).toEqual([]);
  expect(p.onHit(hit({kind:'attack'}))).toEqual([{time:0,name:'Lich Bane Spellblade',type:'magic',raw:165,origin:'item'}]);
  expect(p.onHit(hit({kind:'attack',time:2}))).toEqual([]);
 });
 it('Luden respects explicit initial Echoes and a 12s cooldown on actual spells',()=>{
  const p=procs([],[item(6655)],{effects:{itemProcsReady:true,ludenCharges:3}});
  expect(p.onHit(hit({kind:'attack'}))).toEqual([]);
  expect(total(p.onHit(hit()))).toBeCloseTo(85*1.4);
  expect(p.onHit(hit({time:11.99}))).toEqual([]);
  expect(total(p.onHit(hit({time:12})))).toBe(170);
  expect(procs([],[item(6655)],{effects:{itemProcsReady:true,ludenCharges:0}}).onHit(hit())).toEqual([]);
  expect(procs([],[item(6655)],{effects:{itemProcsReady:false,ludenCharges:6}}).onHit(hit())).toEqual([]);
 });
 it('a hybrid spell may deliver Nashor, Lich Bane and Luden once without recursively proccing itself',()=>{
  const p=procs([],[item(3115),item(3100),item(6655)],{spellbladeReady:true,effects:{itemProcsReady:true,ludenCharges:6}});
  const packets=p.onHit(hit({kind:'on-hit',spellEffects:true,appliesOnHit:true}));
  expect(packets.map(p=>p.name)).toEqual(["Nashor's Tooth Icathian Bite",'Lich Bane Spellblade',"Luden's Echo (6 isolated Echoes)"]);
  expect(total(packets)).toBe(380);
 });
 it('uses Rapid Firecannon only on one ready actual attack without generating charges',()=>{
  const p=procs([],[item(3094)]);
  expect(p.onHit(hit())).toEqual([]);expect(p.onHit(hit({kind:'on-hit'}))).toEqual([]);
  expect(p.onHit(hit({kind:'attack'}))).toEqual([{time:0,name:'Rapid Firecannon Energized',type:'magic',raw:40,origin:'item'}]);
  expect(p.onHit(hit({kind:'attack',time:50}))).toEqual([]);
 });
 it('preserves spell effects on a hybrid spell that also delivers on-hit effects',()=>{
  const p=procs([8229],[item(6653),item(3508)],{spellbladeReady:true});
  const packets=p.onHit(hit({kind:'on-hit',spellEffects:true,appliesOnHit:true}));
  expect(packets.map(x=>x.name)).toEqual(['Arcane Comet','Essence Reaver Spellblade','Liandry Torment','Liandry Torment','Liandry Torment']);
 });
 it('does not turn a passive-labelled on-hit packet into another attack delivery',()=>{
  const p=procs([8229],[item(6653),item(3508)],{spellbladeReady:true});
  expect(p.onHit(hit({kind:'on-hit',spellEffects:false,appliesOnHit:false}))).toEqual([]);
  // The actual hybrid spell remains eligible after its passive packet was seen.
  expect(p.onHit(hit({kind:'on-hit',spellEffects:true,appliesOnHit:true})).some(x=>x.name==='Essence Reaver Spellblade')).toBe(true);
 });
 it('invalid or nondamaging packets and out-of-window hits cannot start effects',()=>{
  for(const bad of [{raw:0},{damage:0},{raw:NaN},{time:-1},{time:61}])expect(procs([8229,8369],[item(6653)],{firstStrikeReady:true}).onHit(hit(bad))).toEqual([]);
 });
 it('Muramana distinguishes repeated ticks of one cast from distinct casts and attacks',()=>{
  const p=procs([],[item(3042)],{effects:{itemProcsReady:true,attackForm:'ranged'}});
  expect(total(p.onHit(hit({castId:'q'})))).toBe(30);
  expect(p.onHit(hit({castId:'q',periodic:true,time:.25}))).toEqual([]);
  expect(total(p.onHit(hit({castId:'e1',time:.5})))).toBe(30);
  expect(total(p.onHit(hit({castId:'e2',time:1})))).toBe(30);
  expect(total(p.onHit(hit({castId:'aa1',kind:'attack',time:1.5})))).toBe(12);
  const melee=createProcEffects({...champion,stats:{attackrange:175}},[item(3042)],scenario([]),stats);
  expect(total(melee.onHit(hit()))).toBe(40);
 });
 it('Heartsteel requires an actual attack, readiness and proximity, and fires once',()=>{
  const p=procs([],[item(3084)],{effects:{itemProcsReady:true,heartsteelReady:true}});
  expect(p.onHit(hit())).toEqual([]);
  expect(total(p.onHit(hit({kind:'attack'})))).toBe(190);
  expect(p.onHit(hit({kind:'attack',time:40}))).toEqual([]);
  expect(procs([],[item(3084)]).onHit(hit({kind:'attack'}))).toEqual([]);
 });
 it('Titanic and Terminus count only full deliveries, with explicit ranged Titanic reduction',()=>{
  const p=procs([],[item(3748),item(3302)],{effects:{itemProcsReady:true,attackForm:'ranged'}});
  expect(p.onHit(hit())).toEqual([]);
  expect(p.onHit(hit({kind:'on-hit',appliesOnHit:false}))).toEqual([]);
  expect(p.onHit(hit({kind:'attack'})).map(p=>p.raw)).toEqual([10,55]);
  expect(total(procs([],[item(3748)],{effects:{itemProcsReady:true,attackForm:'melee'}}).onHit(hit({kind:'attack'})))).toBe(20);
 });
});
