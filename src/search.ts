import {calculate,legalBuild} from './engine';
import type {Champion,Item,Scenario,BuildResult} from './types';
export function searchBuilds(champion:Champion,pool:Item[],scenario:Scenario,locks:number[],excluded:number[],limit=100000,onProgress?:(count:number)=>void){
 const locked=locks.map(id=>pool.find(i=>i.id===id));
 if(locked.some(i=>!i)||locks.some(id=>excluded.includes(id))||!legalBuild(locked as Item[],scenario.budget,scenario.slots,champion.alias))return {best:[] as BuildResult[],examined:0,complete:true};
 const candidates=pool.filter(i=>!locks.includes(i.id)&&!excluded.includes(i.id)),best:BuildResult[]=[];let examined=0,complete=true;
 const visit=(chosen:Item[],index:number)=>{
  if(examined>=limit){complete=false;return;}
  if(chosen.length>0&&legalBuild(chosen,scenario.budget,scenario.slots,champion.alias)){examined++;const result=calculate(champion,chosen,scenario);best.push({ids:chosen.map(i=>i.id).sort((a,b)=>a-b),result});best.sort((a,b)=>b.result.damage-a.result.damage||a.result.cost-b.result.cost||a.ids.join(',').localeCompare(b.ids.join(',')));if(best.length>12)best.pop();if(examined%500===0)onProgress?.(examined);}
  if(chosen.length===scenario.slots)return;
  for(let n=index;n<candidates.length;n++){const next=[...chosen,candidates[n]];if(!legalBuild(next,scenario.budget,scenario.slots,champion.alias))continue;visit(next,n+1);if(!complete)return;}
 };
 visit(locked as Item[],0);return {best,examined,complete};
}
