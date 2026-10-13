import {pages} from './build-recipes.mjs';
import {itemFamilies} from '../src/item-families.mjs';
export const ceilingMetrics=['single-hit','full-window','shield','heal','execute-threshold','stat'];
export function validateCeilings(entries,catalog,resources,complete=true){
 if(!Array.isArray(entries))throw new Error('Expected ceiling entries.');const ids=new Set(),champions=new Set();
 for(const e of entries){
  if(!catalog.champions.some(c=>c.alias===e.champion))throw new Error('Unknown ceiling champion.');champions.add(e.champion);
  const id=`${e.champion}-${e.key}`;if(ids.has(id))throw new Error('Duplicate ceiling target identifier.');ids.add(id);
  if(!/^[a-z0-9-]{1,50}$/.test(e.key))throw new Error('Invalid target key.');
  for(const k of ['name','targetName','objective','mechanic','finiteState','test','limits','tradeoff'])if(typeof e[k]!=='string'||!e[k].trim()||e[k].length>2000)throw new Error(`${e.champion}: missing ${k}.`);
  if(!['P','Q','W','E','R'].includes(e.targetSlot))throw new Error('Invalid target slot.');
  if(!ceilingMetrics.includes(e.metric))throw new Error('Invalid ceiling metric.');
  if(!['physical','magic','true','mixed','none'].includes(e.damageType)||!['plausible','speculative'].includes(e.confidence))throw new Error('Invalid damage type/confidence.');
  if(!pages[e.pageKey])throw new Error('Unknown rune page.');
  if(!Array.isArray(e.itemIds)||e.itemIds.length!==6||new Set(e.itemIds).size!==6)throw new Error('Expected six distinct ceiling items.');
  const items=e.itemIds.map(id=>catalog.items.find(i=>i.id===id));
  if(items.some(i=>!i||!i.maps['11']||(!i.shopListedBySource&&![3040,3042].includes(i.id))||(i.requiredChampion&&i.requiredChampion.toLowerCase()!==e.champion.toLowerCase())))throw new Error(`${e.champion}: illegal ceiling item.`);
  if(itemFamilies.some(f=>items.filter(i=>f.includes(i.id)).length>1)||items.filter(i=>i.tags.includes('Boots')).length>1)throw new Error(`${e.champion}: conflicting item family.`);
  if(resources[e.champion]!=='Mana'&&items.some(i=>i.baseStats.some(s=>s.name==='Mana'&&s.value>0)))throw new Error(`${e.champion}: mana item on non-mana champion.`);
 }
 if(complete&&(champions.size!==catalog.champions.length||catalog.champions.some(c=>!champions.has(c.alias))))throw new Error('Ceilings must cover exact roster.');return entries;
}
export function ceilingBuild(e,kit,catalog,resources){
 const runePage=[...pages[e.pageKey]];if(resources[e.champion]!=='Mana')for(let n=0;n<runePage.length;n++)if(runePage[n]===8226)runePage[n]=8275;
 const rank=e.targetSlot==='P'?5:kit.primaryAbilities.find(a=>a.slot===e.targetSlot)?.maxRank||5;
 const ability=kit.allSpellRecords.filter(s=>s.tooltipWithSymbolicValues&&(s.primarySlot===e.targetSlot||(e.targetSlot==='P'&&s.name===kit.passive.name)));
 const supportsAttack=['hob','pta','lt','conq'].includes(e.pageKey);
 return {id:`${e.champion.toLowerCase()}-ceiling-${e.key}`,champion:e.champion,name:e.name,category:'Ability ceiling',summary:e.objective,goal:e.objective,hypothesis:e.mechanic,itemIds:e.itemIds,runePage,shards:[supportsAttack?5005:5008,5008,5011],conditions:{level:18,rank,eRank:5,mana:1500,duration:e.metric==='full-window'?10:3,mr:50,armor:100,targetHP:3000,heartsteelHP:0,conquerorStacks:0,combatSeconds:0},requiresManualTest:true,ceiling:{targetSlot:e.targetSlot,targetName:e.targetName,metric:e.metric,damageType:e.damageType,finiteState:e.finiteState,verification:'candidate'},testPlan:[`Finite benchmark: ${e.finiteState}`,e.test,'Isolate the named ability/passive packet from item procs, rune damage and the rest of the combo. Record raw versus post-resistance damage, actual crit outcome, charge, rank and target state. Healing/shield/execute thresholds are separate metrics, not damage.','Use the stated benchmark, not free infinite stacks or allied buffs. The initial form fields are editable defaults (level18, target3000HP/100armor/50MR); adjust them and record every other requirement before measuring.'],failureConditions:['The candidate loses the intended packet gain after real mitigation, charge restrictions, proc behavior or buff eligibility is measured.',e.limits],tradeoffs:[e.tradeoff,`Confidence: ${e.confidence}. This is a finite-condition ceiling candidate, not a solver-certified global maximum or a recommended match build.`],buyOrder:['This is a late six-item ceiling loadout. Compare individual item swaps at fixed level, earned stacks and target conditions; the displayed order is not a lane shopping order.','Keep boots and role starters during the actual game. A damage-slot boot replacement requires a deliberate late benchmark and may make the ability impossible to land.'],coverageNotes:['These targets are manual experiments. Existing Cassiopeia Q/E and Sett W numeric adapters cannot certify these whole loadouts, omitted item/rune effects or global maxima.',e.limits,'Unbounded stacks, game time or target health prevent a universal finite maximum; keep their chosen caps explicit.'],author:'ChatGPT',kitEvidence:ability.map(s=>({ability:s.name,slot:s.primarySlot||'Passive',source:s.path,formula:s.tooltipWithSymbolicValues}))};
}
