import {expect,it} from 'vitest';
import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import {legalBuild} from '../src/engine';
import {itemFamilies} from '../src/item-families.mjs';
import resources from '../scripts/champion-resources.json';
const read=()=>JSON.parse(fs.readFileSync('public/data/champion-meta-plans.json','utf8'));
it('publishes one explicit reviewed six-slot plan for every current champion',()=>{
 const data=read();expect(data.patch).toBe(catalog.patch);expect(data.checkedAt).toBe('2026-10-14');
 expect(data.plans).toHaveLength(173);expect(new Set(data.plans.map((p:any)=>p.champion)).size).toBe(173);
 expect(data.plans.map((p:any)=>p.champion).sort()).toEqual(catalog.champions.map(c=>c.alias).sort());
 expect(data).toEqual(JSON.parse(fs.readFileSync('scripts/champion-meta-plans.json','utf8')));
 const index=JSON.parse(fs.readFileSync('public/data/provider-research/index.json','utf8'));
 for(const p of data.plans){
  const source=JSON.parse(fs.readFileSync(`public/data/provider-research/${index.recordsDirectory}/${p.champion}.json`,'utf8')).sources.find((s:any)=>s.provider==='opgg');
  expect(p.role,p.champion).toBe(source.role);expect(p.preferredItemIds,p.champion).toHaveLength(6);
  expect(new Set(p.preferredItemIds).size,p.champion).toBe(6);
  const items=p.preferredItemIds.map((id:number)=>catalog.items.find(i=>i.id===id)!);
  expect(legalBuild(items as any,100000,6,p.champion),p.champion).toBe(true);
  expect(items.filter((i:any)=>i.tags.includes('Boots')),p.champion).toHaveLength(1);
  if(p.role==='support')expect(items.some((i:any)=>[3869,3870,3871,3876,3877].includes(i.id)),p.champion).toBe(true);
  for(const id of [...p.preferredItemIds,...p.situationalItemIds]){
   const item=catalog.items.find(i=>i.id===id)!;expect(item,p.champion).toBeDefined();
   expect(item.maps['11'] && (item.shopListedBySource||[3040,3042,3121,2530].includes(id)),`${p.champion}: ${id}`).toBe(true);
   expect(id,`${p.champion}: ${id}`).toBeLessThan(10000);
   expect([1054,1055,1056,1082,1083,3070,3865,1001],p.champion).not.toContain(id);
   if((resources as Record<string,string>)[p.champion]!=='Mana')expect(item.baseStats.some(s=>/mana/i.test(s.name)),`${p.champion}: ${item.name}`).toBe(false);
  }
  for(const family of itemFamilies)expect(p.preferredItemIds.filter((id:number)=>family.includes(id)).length,p.champion).toBeLessThanOrEqual(1);
  expect(p.summary.length,p.champion).toBeGreaterThan(100);expect(p.notes.some((n:string)=>n.includes('completion')&&n.includes('inference')),p.champion).toBe(true);
  expect(['physical','magic','mixed','true-heavy']).toContain(p.traits.damage);
  for(const key of ['attackBased','heals','shields','hardCC','dive','poke','frontline','armorStacking','attackSpeedThreat'])expect(typeof p.traits[key],`${p.champion}: ${key}`).toBe('boolean');
 }
});
it('retains champion-specific hybrid, resource and current mechanics distinctions',()=>{
 const plans=read().plans;const plan=(c:string)=>plans.find((p:any)=>p.champion===c);
 expect(plan('Ziggs').role).toBe('adc');expect(plan('Ziggs').traits.attackBased).toBe(false);
 expect(plan('Jhin').traits.attackSpeedThreat).toBe(false);expect(plan('Ezreal').traits.attackSpeedThreat).toBe(false);
 for(const c of ['Kaisa','Varus','Kayle','Volibear','TahmKench','Yunara'])expect(plan(c).traits.damage,c).toBe('mixed');
 expect(plan('Locke').traits.hardCC).toBe(false);expect(plan('Locke').traits.heals).toBe(true);
 expect(plan('Zaahen').notes.join(' ')).toMatch(/Determination/);
 expect(plan('Cassiopeia').notes.join(' ')).toMatch(/boots/i);
 expect(plan('Pyke').notes.join(' ')).toMatch(/health/i);
});
