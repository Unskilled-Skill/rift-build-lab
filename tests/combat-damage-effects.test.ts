import {describe,it,expect} from 'vitest';
import {createDamageEffects,type DamageEffectPacket} from '../src/combat-damage-effects';
import {effectTags} from '../src/combat-effect-tags';
import type {Champion,Item,Scenario} from '../src/types';
const champion={alias:'Lux',name:'Lux'} as Champion;
const scenario=(runePage:number[]=[],effects:object={},combatSeconds=0)=>({mode:'cast-q',runePage,combatSeconds,effects} as Scenario);
const item=(id:number)=>({id} as Item);
const packet:DamageEffectPacket={type:'magic',time:0,kind:'ability',ultimate:false};
const factor=(s:Scenario,ids:number[]=[],p:DamageEffectPacket=packet,hp=100,owner=100)=>createDamageEffects(champion,ids.map(item),s).multiplier(p,hp,owner);
describe('source-scoped native damage effects',()=>{
 it('Giant Slayer uses target bonus HP, clamps its cap and excludes true damage',()=>{
  expect(factor(scenario(),[3036])).toBe(1);
  expect(factor(scenario([],{targetBonusHP:750}),[3036])).toBeCloseTo(1.075);
  expect(factor(scenario([],{targetBonusHP:9000}),[3036])).toBeCloseTo(1.15);
  expect(factor(scenario([],{targetBonusHP:1500}),[3036],{...packet,type:'true'})).toBe(1);
 });
 it('evaluates live HP thresholds strictly and never generically amplifies true damage',()=>{
  expect(factor(scenario([8017]),[],packet,60)).toBe(1);
  expect(factor(scenario([8017]),[],packet,60.01)).toBe(1.08);
  expect(factor(scenario([8014]),[],packet,40)).toBe(1);
  expect(factor(scenario([8014]),[],packet,39.99)).toBe(1.08);
  expect(factor(scenario([8299]),[],packet,100,60)).toBe(1);
  expect(factor(scenario([8299]),[],packet,100,45)).toBeCloseTo(1.08);
  expect(factor(scenario([8299]),[],packet,100,30)).toBeCloseTo(1.11);
  expect(factor(scenario([8017,8014,8299,8005],{ptaActive:true,shojinStacks:4},9),[3161,4633,6653],{...packet,type:'true'},20,20)).toBe(1);
 });
 it('requires actual preparation and does not grant triggering-hit stack amplification',()=>{
  expect(factor(scenario([8005]),[3161,8020])).toBe(1);
  expect(factor(scenario([8005],{ptaActive:true,shojinStacks:4,abyssalInRange:true}),[3161,8020])).toBeCloseTo(1.08*1.12*1.12);
  expect(factor(scenario([],{shojinStacks:4}),[3161],{...packet,kind:'attack'})).toBe(1);
 });
 it('ramps only on completed chronological combat seconds',()=>{
  expect(factor(scenario([],{},0),[4633,6653],{...packet,time:.999})).toBe(1);
  expect(factor(scenario([],{},0),[4633,6653],{...packet,time:1})).toBeCloseTo(1.02**2);
  expect(factor(scenario([],{},2),[4633,6653],{...packet,time:2})).toBeCloseTo(1.08*1.06);
  expect(factor(scenario([],{},-4),[4633])).toBe(1);
 });
 it('uses ultimate packet eligibility and keeps basic R stances ineligible',()=>{
  expect(factor(scenario([8224]),[],{...packet,ultimate:'single'})).toBe(1.12);
  expect(factor(scenario([8224]),[],{...packet,ultimate:'area'})).toBe(1.08);
  expect(factor(scenario([8224]),[],{...packet,ultimate:'unknown'})).toBe(1);
  expect(factor(scenario([8224],{axiomMode:'single'}),[],packet)).toBe(1);
  expect(factor(scenario([8224],{axiomMode:'off'}),[],{...packet,ultimate:'area'})).toBe(1);
  expect(effectTags('Udyr','cast-r','Wingborne Storm').ultimate).toBe(false);
  expect(effectTags('Elise','cast-r','Spider attack').ultimate).toBe(false);
  expect(effectTags('Lux','cast-r','Final Spark').ultimate).toBe('area');
  expect(effectTags('Chogath','cast-r','Feast').ultimate).toBe('single');
 });
 it('permits only Shadowflame explicit true-damage exception and excludes physical',()=>{
  expect(factor(scenario(),[4645],{...packet,type:'true'},39)).toBe(1.2);
  expect(factor(scenario(),[4645],{...packet,type:'true'},40)).toBe(1);
  expect(factor(scenario(),[4645],{...packet,type:'physical'},20)).toBe(1);
  expect(factor(scenario(),[4645],{...packet,periodic:true},20)).toBe(1.2);
 });
 it('clamps earned Black Cleaver stacks to current five-stack cap before penetration',()=>{
  expect(createDamageEffects(champion,[item(3071)],scenario()).targetArmor(200)).toBe(200);
  expect(createDamageEffects(champion,[item(3071)],scenario([],{cleaverStacks:6})).targetArmor(200)).toBe(140);
  expect(createDamageEffects(champion,[item(3071)],scenario([],{cleaverStacks:3})).targetArmor(-20)).toBe(-20);
 });
 it('uses current ranged Shojin coefficient from the engine source',()=>{
  const ranged={...champion,stats:{attackrange:550}};
  const melee={...champion,stats:{attackrange:175}};
  const prepared=scenario([],{shojinStacks:4});
  expect(createDamageEffects(ranged,[item(3161)],prepared).multiplier(packet,100,100)).toBe(1.06);
  expect(createDamageEffects(melee,[item(3161)],prepared).multiplier(packet,100,100)).toBe(1.12);
  expect(createDamageEffects(ranged,[item(3161)],scenario([],{shojinStacks:4,attackForm:'melee'})).multiplier(packet,100,100)).toBe(1.12);
  expect(createDamageEffects(melee,[item(3161)],scenario([],{shojinStacks:4,attackForm:'ranged'})).multiplier(packet,100,100)).toBe(1.06);
 });
 it('applies general proc modifiers once without inheriting native Shojin amplification',()=>{
  expect(factor(scenario([8014],{shojinStacks:4,abyssalInRange:true},5),[3161,6653,4633,4645,8020],{...packet,kind:'proc',ultimate:false},20)).toBeCloseTo(1.08*1.06*1.08*1.2*1.12);
 });
 it('applies common effects independently of champion identity or unrelated shards',()=>{
  for(const alias of ['Cassiopeia','Sett','Trundle','Sion','Zac']){
   const s={...scenario([8017]),shards:[5008,5001,5001]};
   expect(createDamageEffects({...champion,alias},[],s).multiplier(packet,100,100)).toBe(1.08);
  }
  expect(effectTags('Blitzcrank','blitz-e','Power Fist (noncritical)').kind).toBe('attack');
  expect(effectTags('Gragas','cast-w','Delivery attack (noncritical)').kind).toBe('attack');
  expect(effectTags('Gragas','cast-w','Drunken Rage bonus').kind).toBe('ability');
  const ezreal=effectTags('Ezreal','cast-q','Mystic Shot');
  expect(ezreal.kind).toBe('on-hit');
  expect(factor(scenario([],{shojinStacks:4}),[3161],{...packet,...ezreal})).toBe(1.12);
  expect(effectTags('Cassiopeia','qe','Twin Fang (poisoned)').aoe).toBe(false);
  expect(effectTags('Cassiopeia','qe','Noxious Blast (observed poison)').aoe).toBe(true);
 });
});
