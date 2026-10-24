import type {Catalog} from './types';
import type {BuildPlan} from './build-plan';
import type {Composition,FullMetaBuild,MetaPlan} from './meta-recommendations';
import {recommendForComp} from './meta-recommendations';
import {roleMetaPlan} from './provider-role-selection';
export interface MatchupAdvice {itemIds:number[];changes:Array<{removed:number;added:number;reason:string}>;priorities:Array<{title:string;reason:string}>;warnings:string[]}
// Runs the Meta tab's composition advisor on any six-item build. The first completed item (and a ranked build's
// observed core) is protected; the advisor only swaps the flexible slots.
export function adaptPlanToComp(data:Catalog,plan:BuildPlan,plans:MetaPlan[],comp:Composition,protectedIds:number[]=[]):MatchupAdvice{
 if(plan.finalItemIds.length!==6)throw new Error('Matchup advice needs a full six-item build.');
 const own=plans.find(p=>p.champion===plan.champion);if(!own)throw new Error('No kit traits are recorded for this champion.');
 let meta=own;if(plan.role!=='unspecified'&&plan.role!==own.role){try{meta=roleMetaPlan(own,plan.role)}catch{/* Keep the main-role traits. */}}
 const first=plan.stages.find(s=>s.id==='first-core')?.buy[0];
 const keep=[...new Set([...protectedIds,...(first!==undefined&&plan.finalItemIds.includes(first)?[first]:[])])];
 const ids=[...plan.finalItemIds];
 const base:FullMetaBuild={champion:plan.champion,role:meta.role,itemIds:ids,runePage:[...plan.runePage],shards:[...plan.shards],buyOrder:[...ids],
  observedCoreItemIds:keep,coreCompletionItemIds:[],inferredItemIds:ids.filter(id=>!keep.includes(id)),sourceOptionItemIds:[],
  reasons:ids.map(id=>({itemId:id,reason:'Item from this build.',kind:keep.includes(id)?'observed-core':'kit-completion'})),
  warnings:[],sourceProvider:'build',sourcePatch:data.patch,checkedAt:plan.checkedAt||'',sourceURL:plan.sourceURL||'',summary:plan.summary};
 const advice=recommendForComp(data,base,meta,plans,comp);
 return {itemIds:advice.build.itemIds,changes:advice.changes,priorities:advice.priorities,warnings:advice.warnings};
}
