import {itemFamilies} from '../src/item-families.mjs';
import {pages} from './build-recipes.mjs';
const text=(v)=>typeof v==='string'&&v.trim().length>0&&v.length<=2000;
export function validateInteractionAudit(entries,catalog,resources,complete=true){
 if(!Array.isArray(entries))throw new Error('Expected audit list.');
 const seen=new Set();
 for(const e of entries){
  if(seen.has(e.champion))throw new Error('Duplicate champion audit.');seen.add(e.champion);
  if(!catalog.champions.some(c=>c.alias===e.champion))throw new Error('Unknown champion audit.');
  if(!Array.isArray(e.reviewedSlots)||!['P','Q','W','E','R'].every(s=>e.reviewedSlots.includes(s)))throw new Error(`${e.champion}: incomplete slot review.`);
  if(!Array.isArray(e.opportunities)||e.opportunities.length!==2)throw new Error(`${e.champion}: expected two distinct opportunities.`);
  const keys=new Set();
  for(const o of e.opportunities){
   if(!/^[a-z0-9-]{1,55}$/.test(o.key)||keys.has(o.key))throw new Error(`${e.champion}: duplicate/invalid route key.`);keys.add(o.key);
   for(const k of ['name','objective','mechanic','requiredState','failure','test','rejectedAssumption'])if(!text(o[k]))throw new Error(`${e.champion}: missing ${k}.`);
   if(!['plausible','speculative'].includes(o.confidence))throw new Error(`${e.champion}: missing confidence.`);
   if(!Array.isArray(o.evidenceSlots)||!o.evidenceSlots.length||o.evidenceSlots.some(s=>!['P','Q','W','E','R'].includes(s)))throw new Error(`${e.champion}: missing evidence slots.`);
   if(!pages[o.pageKey])throw new Error(`${e.champion}: invalid rune page key.`);
   if(!Array.isArray(o.itemIds)||o.itemIds.length!==6||new Set(o.itemIds).size!==6)throw new Error(`${e.champion}: expected six distinct items.`);
   const items=o.itemIds.map(id=>catalog.items.find(i=>i.id===id));
   if(items.some(i=>!i||!i.maps['11']||(!i.shopListedBySource&&![3040,3042].includes(i.id))||(i.requiredChampion&&i.requiredChampion.toLowerCase()!==e.champion.toLowerCase())))throw new Error(`${e.champion}: illegal item source.`);
   for(const family of itemFamilies)if(items.filter(i=>family.includes(i.id)).length>1)throw new Error(`${e.champion}: conflicting item family.`);
   if(items.filter(i=>i.tags.includes('Boots')).length>1)throw new Error(`${e.champion}: multiple boots.`);
   if(items.filter(i=>i.effectDescriptionText.includes('Spellblade')).length>1)throw new Error(`${e.champion}: multiple Spellblade items.`);
   if(resources[e.champion]!=='Mana'&&items.some(i=>i.baseStats.some(s=>s.name==='Mana'&&s.value>0)))throw new Error(`${e.champion}: mana item on non-mana champion.`);
  }
  if(new Set(e.opportunities.map(o=>[...o.itemIds].sort((a,b)=>a-b).join(','))).size!==2)throw new Error(`${e.champion}: duplicate item sets for opportunities.`);
  if(!Array.isArray(e.ruledOut)||!e.ruledOut.length||e.ruledOut.some(r=>!text(r.idea)||!text(r.reason)||!Array.isArray(r.evidenceSlots)||!r.evidenceSlots.length))throw new Error(`${e.champion}: missing rejected interaction evidence.`);
  if(!Array.isArray(e.unknowns)||e.unknowns.some(u=>!text(u)))throw new Error(`${e.champion}: invalid unknowns.`);
 }
 if(complete&&(entries.length!==catalog.champions.length||catalog.champions.some(c=>!seen.has(c.alias))))throw new Error('Audit must cover the exact roster.');
 return entries;
}
export function interactionBuild(entry,idea,kit,catalog,resources){
 const page=[...pages[idea.pageKey]];
 if(resources[entry.champion]!=='Mana')for(let n=0;n<page.length;n++)if(page[n]===8226)page[n]=8275;
 const itemNames=idea.itemIds.map(id=>catalog.items.find(i=>i.id===id).name);
 const kitEvidence=kit.allSpellRecords.filter(s=>s.tooltipWithSymbolicValues&&(idea.evidenceSlots.includes(s.primarySlot)||(idea.evidenceSlots.includes('P')&&s.name===kit.passive.name))).map(s=>({ability:s.name,slot:s.primarySlot||'Passive',source:s.path,formula:s.tooltipWithSymbolicValues}));
 return {id:`${entry.champion.toLowerCase()}-audit-${idea.key}`.slice(0,80),champion:entry.champion,name:idea.name,category:'Kit interaction',requiresManualTest:true,summary:idea.objective,goal:idea.objective,hypothesis:idea.mechanic,itemIds:idea.itemIds,runePage:page,shards:[['pta','lt','hob','conq'].includes(idea.pageKey)?5005:5008,5008,5011],conditions:{level:18,rank:5,eRank:5,duration:10,mana:1500,armor:100,mr:50,targetHP:3000,heartsteelHP:0,conquerorStacks:0,combatSeconds:0},testPlan:[`Required state: ${idea.requiredState}`,idea.test,'Run three trials at matched level, ranks, gold and target defenses. Repeat against a moving opponent with a fixed incoming damage pattern. Record damage packets, missed actions, resource cost and survival separately.','Keep souls, health/mana, form, item/rune stacks, transformations and game time finite and explicitly recorded. No free full ramp or infinite scaling.'],failureConditions:[idea.failure,'The narrow damage gain does not repay lost access, survival, wave control or allied utility.'],tradeoffs:[`Rejected assumption: ${idea.rejectedAssumption}`,`Confidence: ${idea.confidence}. Source-compatible reasoning is not in-game validation or proof of novelty/optimality.`],buyOrder:[`Candidate six slots: ${itemNames.join(', ')}. Compare two-item checkpoints before the final six-slot test; this list is not a lane shopping order.`,'Keep role-appropriate starters, boots and support quest/vision obligations. If the full candidate assumes farmed income, compare it separately from support income.'],coverageNotes:['Only Cassiopeia Q/E and Sett W have numerical adapters. Even there, these other objectives and item/rune interactions may fall outside the model.', 'Proc inheritance, crit, pet hits and conditional helpers remain uncertain until observed. No completed mathematical maximum is claimed.'],author:'ChatGPT',kitEvidence};
}
