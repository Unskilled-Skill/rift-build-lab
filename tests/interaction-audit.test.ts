import fs from 'node:fs';
import {parseChatBuilds} from '../src/chat-builds';
import type {Catalog} from '../src/types';
import {it,expect} from 'vitest';
import catalog from '../public/data/catalog.json';
import resources from '../scripts/champion-resources.json';
import {validateInteractionAudit,interactionBuild} from '../scripts/interaction-audit.mjs';
const idea={key:'fist',name:'AD E',objective:'One E',mechanic:'E total AD scaling',evidenceSlots:['E'],itemIds:[3031,3508,6676,3036,3072,3009],pageKey:'first',requiredState:'E ready',failure:'No access',test:'Compare E packets',rejectedAssumption:'No doubled item procs',confidence:'plausible'};
const entry={champion:'Blitzcrank',reviewedSlots:['P','Q','W','E','R'],opportunities:[idea,{...idea,key:'fist-2',itemIds:[3031,3508,6676,3036,3142,3009]}],ruledOut:[{idea:'Double Spellblade',reason:'Separate proc',evidenceSlots:['E']}],unknowns:['Crit behavior']};
it('rejects incomplete coverage and duplicate champion audits',()=>{expect(()=>validateInteractionAudit([entry],catalog,resources)).toThrow(/roster/);expect(()=>validateInteractionAudit([entry,entry],catalog,resources)).toThrow(/duplicate/i)});
it('rejects champion-illegal mana routes and conflicting item effects',()=>{const noMana={...entry,champion:'Akali',opportunities:entry.opportunities.map(x=>({...x,itemIds:[3042,3100,3089,3135,3157,3020]}))};expect(()=>validateInteractionAudit([noMana],catalog,resources,false)).toThrow(/mana/i);const conflict={...entry,opportunities:[{...idea,itemIds:[3508,3078,3031,3036,3072,3009]},entry.opportunities[1]]};expect(()=>validateInteractionAudit([conflict],catalog,resources,false)).toThrow(/Spellblade|family/i)});
it('requires actionable evidence, test and falsification rather than a renamed package',()=>{expect(()=>validateInteractionAudit([{...entry,opportunities:[{...idea,evidenceSlots:[]},entry.opportunities[1]]}],catalog,resources,false)).toThrow(/evidence/i);expect(()=>validateInteractionAudit([{...entry,opportunities:[{...idea,failure:''},entry.opportunities[1]]}],catalog,resources,false)).toThrow(/failure/i);expect(validateInteractionAudit([entry],catalog,resources,false)).toHaveLength(1)});

it('keeps speculative ability objectives out of an unrelated numeric adapter',()=>{const b=interactionBuild({...entry,champion:'Cassiopeia'},idea,{passive:{name:'P'},allSpellRecords:[]},catalog,resources) as {requiresManualTest:boolean};expect(b.requiresManualTest).toBe(true)});

it('publishes exact roster coverage with legal manual tests and traceable evidence',()=>{
 const index=JSON.parse(fs.readFileSync('public/data/interaction-audit/index.json','utf8'));
 expect(index.champions.slice().sort()).toEqual(catalog.champions.map(c=>c.alias).sort());
 expect(index.opportunityCount).toBe(catalog.champions.length*2);
 for(const alias of index.champions){
  const entry=JSON.parse(fs.readFileSync(`public/data/interaction-audit/${alias}.json`,'utf8'));
  expect(entry.champion).toBe(alias);expect(entry.reviewedSlots).toEqual(expect.arrayContaining(['P','Q','W','E','R']));
  expect(entry.opportunities).toHaveLength(2);expect(entry.ruledOut.length).toBeGreaterThan(0);
  const builds=parseChatBuilds(JSON.stringify({version:1,patch:entry.patch,builds:entry.builds}),catalog as unknown as Catalog);
  expect(builds).toHaveLength(2);for(const b of builds){expect(b.champion).toBe(alias);expect(b.requiresManualTest).toBe(true)}
 }
});
