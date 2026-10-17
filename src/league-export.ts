import type {Catalog} from './types';
import type {PurchaseCheckpoint} from './purchase-checkpoints';
import {legalBuild} from './build-rules';
import {validRunePage} from './storage';
import type {BuildPlan} from './build-plan';
export interface LeagueExportSetup {champion:string;name:string;itemIds:number[];runePage:number[];shards:number[]}
export interface LeagueItemSet {title:string;type:'custom';map:'SR';mode:'any';sortrank:number;associatedMaps:number[];associatedChampions:number[];blocks:Array<{type:string;items:Array<{id:string;count:number}>}>}
export interface LeagueRunePage {name:string;primaryStyleId:number;subStyleId:number;selectedPerkIds:number[];current:true}
export interface CompanionBundle {version:1;patch:string;dataVersion:string;championId:number;championAlias:string;buildName:string;itemSet:LeagueItemSet;runePage:LeagueRunePage;labels:{items:Record<string,string>;runes:Record<string,string>}}
export const earnedPrerequisites:Readonly<Record<number,number>>={3040:3003,3042:3004,3121:3119,2530:2526,3869:3865,3870:3865,3871:3865,3876:3865,3877:3865};
const clean=(text:string,max:number)=>text.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
export function createLeagueItemSet(data:Catalog,setup:Pick<LeagueExportSetup,'champion'|'name'|'itemIds'>,checkpoints:PurchaseCheckpoint[]=[]):LeagueItemSet{
 const champion=data.champions.find(c=>c.alias===setup.champion);if(!champion)throw Error('Select a known champion first.');
 const selected=setup.itemIds.map(id=>data.items.find(i=>i.id===id));if(!selected.length||selected.length>6||selected.some(i=>!i)||!legalBuild(selected as Catalog['items'],100000,6,setup.champion))throw Error('Equip one to six legal items before exporting.');
 const blocks:LeagueItemSet['blocks']=[];
 const add=(title:string,ids:number[])=>{if(!ids.length)return;const counts=new Map<number,number>();for(const id of ids){const target=earnedPrerequisites[id]||id;const item=data.items.find(i=>i.id===target);if(!item||!item.name||!item.maps['11']||!item.shopListedBySource||/^(32|66)\d{4}$/.test(String(target)))throw Error('This item is not eligible for a Summoner’s Rift item-set export.');counts.set(target,(counts.get(target)||0)+1)}if(counts.size>12||[...counts.values()].some(n=>n>9))throw Error('An export block contains too many items.');blocks.push({type:clean(title,80),items:[...counts].map(([id,count])=>({id:String(id),count}))});};
 for(const point of checkpoints){add(`${point.title}${point.title==='Starting purchase'?' (inferred)':''}`,point.itemIds);if(point.choiceIds?.length)add(`${point.title} — choose one option`,point.choiceIds)}
 add('Final build — buy prerequisites; earn upgrades',setup.itemIds);
 if(blocks.length>16)throw Error('Too many purchase checkpoints to export.');
 return {title:clean(`Rift Build Lab · ${champion.name} · ${setup.name}`,80),type:'custom',map:'SR',mode:'any',sortrank:0,associatedMaps:[11],associatedChampions:[champion.id],blocks};
}
export function createLeagueRunePage(data:Catalog,runes:number[],shards:number[]):LeagueRunePage{
 if(!validRunePage(runes,data.trees))throw Error('Select a legal full rune page before exporting to the companion.');
 const rows=[[5005,5007,5008],[5008,5010,5001],[5011,5013,5001]];
 if(shards.length!==3||shards.some((id,n)=>!rows[n].includes(id)))throw Error('Select a legal stat shard in each row.');
 const primary=data.trees.find(t=>t.slots[0].runes.some(r=>r.id===runes[0]))!;
 const secondary=data.trees.find(t=>t.id!==primary.id&&t.slots.slice(1).some(slot=>slot.runes.some(r=>r.id===runes[4])))!;
 return {name:'Rift Build Lab',primaryStyleId:primary.id,subStyleId:secondary.id,selectedPerkIds:[...runes,...shards],current:true};
}
export function createCompanionBundle(data:Catalog,setup:LeagueExportSetup,checkpoints:PurchaseCheckpoint[]=[]):CompanionBundle{
 const itemSet=createLeagueItemSet(data,setup,checkpoints),runePage=createLeagueRunePage(data,setup.runePage,setup.shards);const champion=data.champions.find(c=>c.alias===setup.champion)!;
 const itemIds=[...new Set(itemSet.blocks.flatMap(b=>b.items.map(i=>i.id)))];
 return {version:1,patch:data.patch,dataVersion:data.version,championId:champion.id,championAlias:champion.alias,buildName:clean(setup.name,120),itemSet,runePage,labels:{items:Object.fromEntries(itemIds.map(id=>[id,data.items.find(i=>String(i.id)===id)!.name])),runes:Object.fromEntries(runePage.selectedPerkIds.map(id=>[String(id),data.runes.find(r=>r.id===id)?.name||String(id)]))}};
}
export function companionURI(bundle:CompanionBundle):string{
 const bytes=new TextEncoder().encode(JSON.stringify(bundle));const encoded=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');const uri=`riftbuildlab://import?data=${encoded}`;
 if(uri.length>20000)throw Error('This bundle is too large for a direct handoff. Download the items + runes file instead.');return uri;
}
export function downloadLeagueJSON(value:unknown,filename:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
// Available stages before the final inventory become League shop blocks; unavailable stages are never exported.
export function planCheckpoints(plan:BuildPlan):PurchaseCheckpoint[]{return plan.stages.filter(s=>s.available&&s.id!=='final').map(s=>({title:s.title,itemIds:[...s.buy],choiceIds:s.chooseOne.length?[...s.chooseOne]:undefined,note:s.note}))}
// Test-bench exports keep one block per equipped item, matching the order shown on the bench.
export function workspaceCheckpoints(plan:BuildPlan):PurchaseCheckpoint[]{return plan.finalItemIds.map((id,n)=>({title:`Purchase ${n+1}`,itemIds:[id],note:'Current equipped order'}))}
export function createLeagueItemSetFromPlan(data:Catalog,plan:BuildPlan,checkpoints=planCheckpoints(plan)):LeagueItemSet{return createLeagueItemSet(data,{champion:plan.champion,name:plan.name,itemIds:plan.finalItemIds},checkpoints)}
export function createBundleFromPlan(data:Catalog,plan:BuildPlan,checkpoints=planCheckpoints(plan)):CompanionBundle{return createCompanionBundle(data,{champion:plan.champion,name:plan.name,itemIds:plan.finalItemIds,runePage:plan.runePage,shards:plan.shards},checkpoints)}
