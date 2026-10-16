import {calculate} from './engine';
import type {Champion,Item,Result,Scenario} from './types';
export type DefenseAxis='mr'|'armor'|'targetHP';
export interface TargetComparison {experiment:Result;baseline:Result;delta:number;percent:number|null;spendingGap:number}
export function compareAtTarget(champion:Champion,experiment:Item[],baseline:Item[],scenario:Scenario,baselineScenario:Scenario):TargetComparison {
 // A baseline supplies its rune choices, never a different target or cast setup.
 const reference={...scenario,runePage:baselineScenario.runePage,shards:baselineScenario.shards};
 const a=calculate(champion,experiment,scenario),b=calculate(champion,baseline,reference);
 const delta=a.damage-b.damage;
 return {experiment:a,baseline:b,delta,percent:b.damage>0?100*delta/b.damage:null,spendingGap:a.cost-b.cost};
}
export function purchaseAtBudget(items:Item[],budget:number){
 if(!Number.isFinite(budget)||budget<0)throw Error('Purchase budget must be a finite nonnegative value.');
 const purchased:Item[]=[];let spent=0;
 for(const item of items){if(spent+item.gold.total>budget)break;purchased.push(item);spent+=item.gold.total;}
 return {items:purchased,unspent:budget-spent};
}
const prerequisites:Record<number,number>={3040:3003,3042:3004,3121:3119,2530:2526};
export function progressionRows(champion:Champion,experiment:Item[],baseline:Item[],scenario:Scenario,baselineScenario:Scenario,budgets:number[],earned=false,catalog:Item[]=[]){
 const normalize=(items:Item[])=>items.map(item=>{
  if(earned||!prerequisites[item.id])return item;
  const base=catalog.find(i=>i.id===prerequisites[item.id]);
  if(!base)throw Error(`The purchasable prerequisite for ${item.name} is unavailable.`);
  return base;
 });
 const a=normalize(experiment).slice(0,scenario.slots),b=normalize(baseline).slice(0,scenario.slots);
 const stage=(s:Scenario):Scenario=>earned?s:{...s,rodStacks:0,heartsteelHP:0,gatheringMinutes:0};
 return [...new Set(budgets)].sort((x,y)=>x-y).map(budget=>{
  const left=purchaseAtBudget(a,budget),right=purchaseAtBudget(b,budget);
  return {...compareAtTarget(champion,left.items,right.items,stage(scenario),stage(baselineScenario)),budget,experimentIds:left.items.map(i=>i.id),baselineIds:right.items.map(i=>i.id),experimentUnspent:left.unspent,baselineUnspent:right.unspent};
 });
}
export function defenseSweep(champion:Champion,experiment:Item[],baseline:Item[],scenario:Scenario,baselineScenario:Scenario,axis:DefenseAxis,min:number,max:number,steps=9){
 if(!['mr','armor','targetHP'].includes(axis)||!Number.isFinite(min)||!Number.isFinite(max)||max<min||min<(axis==='targetHP'?1:-1000)||max>(axis==='targetHP'?100000:10000)||!Number.isInteger(steps)||steps<2||steps>41)throw Error('Choose a valid defense range with the upper value at least the lower value.');
 return Array.from({length:steps},(_,index)=>{
  const value=min+(max-min)*index/(steps-1);
  return {value,...compareAtTarget(champion,experiment,baseline,{...scenario,[axis]:value},baselineScenario)};
 });
}
