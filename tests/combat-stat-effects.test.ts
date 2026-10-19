import {describe,it,expect} from 'vitest';
import {combatStatBonuses,applyCombatDefenses} from '../src/combat-stat-effects';
import {defaultScenario} from '../src/scenario';
import type {Champion,Item,Scenario} from '../src/types';
const champion=(alias='Sett',range=125):Champion=>({id:1,alias,name:alias,title:'',roles:[],stats:{attackdamage:60,attackdamageperlevel:4,attackrange:range},profile:null});
const item=(id:number)=>({id,name:String(id),baseStats:[],gold:{total:0},descriptionText:'',effectDescriptionText:'',shopListedBySource:true,maps:{},requiredChampion:null,buildsInto:[],tags:[],iconUrl:''} as Item);
const scenario=(runes:number[],effects:Scenario['effects']={},other:Partial<Scenario>={}):Scenario=>({...defaultScenario('Sett'),runePage:runes,effects,...other});
describe('explicit prepared combat stat effects',()=>{
 it('does not grant earned stacks from selecting a rune or carrying inactive items',()=>{
  const result=combatStatBonuses(champion(),[item(6697)],scenario([9103,8226,8345,8451,8437,8316,8008,9923]));
  expect(result).toMatchObject({bonusHP:0,bonusMana:0,bonusAD:0,bonusAS:0,adaptiveForce:0,hpMultiplier:1});
 });
 it('counts completed groups, caps earned rune counters, and keeps total-health multiplication separate',()=>{
  const result=combatStatBonuses(champion(),[],scenario([9103,8345,8451,8437],{bloodlineStacks:99,biscuits:99,overgrowthUnits:150,graspStacks:30}));
  expect(result.bonusHP).toBe(85+90+54+150);
  expect(result.hpMultiplier).toBe(1.035);
  expect(combatStatBonuses(champion(),[],scenario([8451],{overgrowthUnits:119}))).toMatchObject({bonusHP:42,hpMultiplier:1});
  expect(combatStatBonuses(champion(),[],scenario([8451],{overgrowthUnits:120}))).toMatchObject({bonusHP:45,hpMultiplier:1.035});
  expect(combatStatBonuses(champion(),[],scenario([9103],{bloodlineStacks:14})).bonusHP).toBe(0);
 });
 it('uses ranged Grasp health and explicit historical form override',()=>{
  expect(combatStatBonuses(champion('Vayne',550),[],scenario([8437],{graspStacks:30})).bonusHP).toBe(60);
  expect(combatStatBonuses(champion('Gnar',175),[],scenario([8437],{graspStacks:30},{mode:'cast-q'})).bonusHP).toBe(60);
  expect(combatStatBonuses(champion('Elise',550),[],scenario([8437],{graspStacks:30,attackForm:'melee'})).bonusHP).toBe(150);
 });
 it('grants mana only to mana users and never invents mana-to-AP/AD conversions',()=>{
  expect(combatStatBonuses(champion('Cassiopeia'),[],scenario([8226],{manaflowStacks:99}))).toMatchObject({bonusMana:250,bonusAD:0,adaptiveForce:0});
  for(const alias of ['Sett','Akali','Gnar'])expect(combatStatBonuses(champion(alias),[],scenario([8226],{manaflowStacks:10})).bonusMana).toBe(0);
 });
 it('gates Absolute Focus at strictly above 70% and scales its level endpoints',()=>{
  expect(combatStatBonuses(champion(),[],scenario([8233],{},{healthPercent:70})).adaptiveForce).toBe(0);
  expect(combatStatBonuses(champion(),[],scenario([8233],{},{healthPercent:70.01,level:1})).adaptiveForce).toBe(3);
  expect(combatStatBonuses(champion(),[],scenario([8233],{},{level:18})).adaptiveForce).toBe(30);
 });
 it('counts Jack general haste and threshold adaptive force without mixing in rune stats',()=>{
  for(const [stacks,adaptive] of [[0,0],[4,0],[5,8],[9,8],[10,20],[99,20]]){
   expect(combatStatBonuses(champion(),[],scenario([8316],{jackStacks:stacks}))).toMatchObject({adaptiveForce:adaptive,haste:Math.min(10,stacks)});
  }
 });
 it('gates Waterwalking adaptive force on explicit river position and uses level endpoints',()=>{
  expect(combatStatBonuses(champion(),[],scenario([8232])).adaptiveForce).toBe(0);
  expect(combatStatBonuses(champion(),[],scenario([8232],{inRiver:true},{level:1})).adaptiveForce).toBe(13);
  expect(combatStatBonuses(champion(),[],scenario([8232],{inRiver:true},{level:18})).adaptiveForce).toBe(30);
 });
 it('converts only Hecarim observed bonus movement speed with source breakpoint scaling',()=>{
  const hecarim={...champion('Hecarim'),stats:{movespeed:345,attackdamage:66,attackdamageperlevel:3.7}};
  expect(combatStatBonuses(hecarim,[],scenario([]))).toMatchObject({bonusAD:0});
  for(const [level,ratio] of [[1,.12],[2,.12],[3,.14],[5,.14],[6,.16],[9,.18],[12,.20],[15,.22],[18,.24]]){
   expect(combatStatBonuses(hecarim,[],scenario([],{movementSpeed:450},{level})).bonusAD).toBeCloseTo(105*ratio);
  }
  expect(combatStatBonuses(hecarim,[],scenario([],{movementSpeed:300})).bonusAD).toBe(0);
  expect(combatStatBonuses(champion('Vayne',550),[],scenario([],{movementSpeed:450})).bonusAD).toBe(0);
  expect(combatStatBonuses(hecarim,[],scenario([8232],{movementSpeed:450,inRiver:true}))).toMatchObject({adaptiveForce:30,bonusAD:25.2});
 });
 it('separates baseline Alacrity from earned stacks and basic-only Legend Haste',()=>{
  expect(combatStatBonuses(champion(),[],scenario([9104,9105])).bonusAS).toBe(.03);
  const out=combatStatBonuses(champion(),[],scenario([9104,9105],{alacrityStacks:10,legendHasteStacks:10}));
  expect(out.bonusAS).toBeCloseTo(.18);expect(out.basicHaste).toBe(15);expect(out.haste).toBe(0);
 });
 it('learns Transcendence general haste at levels 5 and 8, without free takedown refunds',()=>{
  for(const [level,haste] of [[4,0],[5,5],[7,5],[8,10],[18,10]])expect(combatStatBonuses(champion(),[],scenario([8210],{},{level}))).toMatchObject({haste,basicHaste:0});
 });
 it('requires active HoB and supplied Tempo stacks and obeys ranged values',()=>{
  expect(combatStatBonuses(champion(),[],scenario([8008,9923],{lethalTempoStacks:6,hailOfBladesActive:true})).bonusAS).toBeCloseTo(1.26);
  expect(combatStatBonuses(champion('Vayne',550),[],scenario([8008,9923],{lethalTempoStacks:6,hailOfBladesActive:true})).bonusAS).toBeCloseTo(.84);
 });
 it('requires a qualifying Hubris kill and active 90-second buff; Sterak uses grown base AD',()=>{
  expect(combatStatBonuses(champion(),[item(6697)],scenario([],{hubrisKills:20,hubrisActive:false})).bonusAD).toBe(0);
  expect(combatStatBonuses(champion(),[item(6697)],scenario([],{hubrisKills:0,hubrisActive:true})).bonusAD).toBe(0);
  expect(combatStatBonuses(champion(),[item(6697)],scenario([],{hubrisKills:1,hubrisActive:true})).bonusAD).toBe(15);
  expect(combatStatBonuses(champion(),[item(3053)],scenario([],{},{level:18})).bonusAD).toBe(64);
  expect(combatStatBonuses(champion(),[item(3053)],scenario([],{},{level:2})).bonusAD).toBeCloseTo(31.44);
 });
 it('ignores unrelated effects without their rune or item and sanitizes nonfinite counters',()=>{
  const e={bloodlineStacks:15,manaflowStacks:10,biscuits:3,overgrowthUnits:150,graspStacks:30,jackStacks:10,alacrityStacks:10,lethalTempoStacks:6,hubrisKills:20,hubrisActive:true};
  expect(combatStatBonuses(champion(),[],scenario([],e))).toMatchObject({bonusHP:0,bonusMana:0,bonusAD:0,bonusAS:0,adaptiveForce:0,hpMultiplier:1});
  expect(combatStatBonuses(champion(),[],scenario([8451,8437,8316],{overgrowthUnits:Infinity,graspStacks:NaN,jackStacks:-3}))).toMatchObject({bonusHP:0,adaptiveForce:0,haste:0});
 });
});
describe('prepared resistance snapshots',()=>{
 it('does not infer activation merely from rune choice or item ownership',()=>{
  expect(applyCombatDefenses(100,50,100,50,[item(6665)],scenario([8429,8439,8242],{},{combatSeconds:10,gatheringMinutes:30}))).toMatchObject({bonusArmor:100,bonusMR:50});
 });
 it('requires Conditioning time and explicit state and boosts total resistance without duplicating base',()=>{
  expect(applyCombatDefenses(100,50,100,50,[],scenario([8429],{conditioningActive:true},{gatheringMinutes:11.99})).bonusArmor).toBe(100);
  const out=applyCombatDefenses(100,50,100,50,[],scenario([8429],{conditioningActive:true},{gatheringMinutes:12}));
  expect(out.bonusArmor).toBeCloseTo(114.24);expect(out.bonusMR).toBeCloseTo(61.24);
 });
 it('caps Aftershock per resistance and level; uses only explicit previous proc',()=>{
  expect(applyCombatDefenses(100,50,100,0,[],scenario([8439],{aftershockActive:true},{level:1}))).toMatchObject({bonusArmor:180,bonusMR:45});
  expect(applyCombatDefenses(100,50,1000,0,[],scenario([8439],{aftershockActive:true},{level:18}))).toMatchObject({bonusArmor:1150,bonusMR:45});
 });
 it('requires five real combat seconds plus explicit JakSho readiness; scales bonus resists only',()=>{
  const items=[item(6665)];
  expect(applyCombatDefenses(100,50,100,50,items,scenario([],{jakshoActive:true},{combatSeconds:4.99})).bonusArmor).toBe(100);
  expect(applyCombatDefenses(100,50,100,50,items,scenario([],{jakshoActive:true},{combatSeconds:5}))).toMatchObject({bonusArmor:130,bonusMR:65});
 });
 it('explains the explicitly ordered combined temporary snapshot and never solves a recursive feedback loop',()=>{
  const out=applyCombatDefenses(100,50,100,50,[item(6665)],scenario([8439,8242],{aftershockActive:true,unflinchingActive:true,jakshoActive:true},{combatSeconds:5}));
  expect(out.bonusArmor).toBeCloseTo((110+45+.75*110)*1.3);
  expect(out.notes.join(' ')).toContain('Other trigger orders');
 });
});
