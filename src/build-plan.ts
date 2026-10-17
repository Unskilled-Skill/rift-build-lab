import type {Catalog} from './types';
import type {ChatBuild} from './chat-builds';
import type {FullMetaBuild} from './meta-recommendations';
import {purchaseCheckpoints} from './purchase-checkpoints';
import {earnedPrerequisites} from './league-export';
import {legalBuild} from './engine';
import {validRunePage} from './storage';
// One presentation/export contract for authored builds, ceilings, experiments, meta references and generated meta plans.
export type Provenance='source-observed'|'authored'|'inferred'|'calculator';
export type StageId='start'|'early-recall'|'first-core'|'boots'|'later-core'|'situational'|'final';
export type PlanRole='top'|'jungle'|'mid'|'adc'|'support'|'unspecified';
export type PlanCollection='authored'|'ceiling'|'experiment'|'meta-reference'|'meta'|'workspace';
export interface PurchaseStage {id:StageId;title:string;buy:number[];chooseOne:number[];note:string;provenance:Provenance;available:boolean;cumulativeGold?:number}
export interface BuildPlan {
 id:string;collection:PlanCollection;champion:string;role:PlanRole;
 name:string;category:string;goal:string;summary:string;
 patch:string;dataVersion:string;checkedAt?:string;sourceURL?:string;
 finalItemIds:number[];runePage:number[];shards:number[];
 stages:PurchaseStage[];authoredPriorities:string[];
 provenance:{items:Provenance;runes:Provenance;order:Provenance};
 limits:string[];
}
export class BuildPlanError extends Error {
 constructor(public code:'unknown-champion'|'illegal-items'|'illegal-runes'|'stage-overlap',message:string){super(message);this.name='BuildPlanError'}
}
const shardRows=[[5005,5007,5008],[5008,5010,5001],[5011,5013,5001]];
const finalQuests=[3869,3870,3871,3876,3877];
const metaStageIds:Record<string,StageId>={'Starting purchase':'start','First recall options':'early-recall','First core target':'first-core','Boots window':'boots','Matchup purchase window':'situational','After the core':'later-core'};
export function normalizeRole(role:string):PlanRole{
 const r=role.trim().toLowerCase();
 return r==='top'||r==='jungle'?r:r==='mid'||r==='middle'?'mid':r==='adc'||r==='bot'||r==='bottom'?'adc':r==='support'||r==='utility'?'support':'unspecified';
}
function validate(data:Catalog,champion:string,itemIds:number[],runePage:number[],shards:number[]){
 if(!data.champions.some(c=>c.alias===champion))throw new BuildPlanError('unknown-champion',`Unknown champion ${champion}.`);
 const items=itemIds.map(id=>data.items.find(i=>i.id===id));
 if(!items.length||items.length>6||items.some(i=>!i)||!legalBuild(items as Catalog['items'],100000,6,champion))throw new BuildPlanError('illegal-items','A build plan needs one to six legal items.');
 if(!validRunePage(runePage,data.trees)||shards.length!==3||shards.some((id,n)=>!shardRows[n].includes(id)))throw new BuildPlanError('illegal-runes','A build plan needs a legal rune page and one shard per row.');
}
// Completed-item gold so far; starting consumables are excluded because they are sold or used up.
function finish(data:Catalog,stages:PurchaseStage[]):PurchaseStage[]{
 const counted=new Set<number>();let gold=0;
 return stages.map(stage=>{
  if(stage.buy.some(id=>stage.chooseOne.includes(id)))throw new BuildPlanError('stage-overlap',`${stage.title} lists an item as both a purchase and an alternative.`);
  if(!stage.available||stage.id==='start'||!stage.buy.length)return stage;
  for(const id of stage.buy){const paid=earnedPrerequisites[id]||id;if(counted.has(paid))continue;counted.add(paid);gold+=data.items.find(i=>i.id===paid)?.gold.total||0}
  return {...stage,cumulativeGold:gold};
 });
}
const unavailable=(id:StageId,title:string,note:string):PurchaseStage=>({id,title,buy:[],chooseOne:[],note,provenance:'authored',available:false});
export function planFromChatBuild(data:Catalog,build:ChatBuild,collection:'authored'|'ceiling'|'experiment'|'meta-reference'):BuildPlan{
 validate(data,build.champion,build.itemIds,build.runePage,build.shards);
 const isBoot=(id:number)=>data.items.find(i=>i.id===id)!.tags.includes('Boots');
 const observed=new Set(build.meta?.observedCoreItemIds||[]);
 const firstFinal=build.itemIds.find(id=>!isBoot(id)&&!finalQuests.includes(id))??build.itemIds.find(id=>!isBoot(id));
 const own:Provenance='authored';
 const boots=build.itemIds.filter(isBoot),later=build.itemIds.filter(id=>id!==firstFinal&&!isBoot(id));
 const stages:PurchaseStage[]=[
  unavailable('start','Starting purchase','No reviewed starting purchase is recorded for this build. Choose a standard start for the lane and resource.'),
  unavailable('early-recall','First recall options','No reviewed recall script is recorded for this build. Buy components toward the first core.'),
  firstFinal===undefined?unavailable('first-core','First core target','This build has no non-boot item to prioritize.'):{id:'first-core',title:'First core target',buy:[earnedPrerequisites[firstFinal]||firstFinal],chooseOne:[],note:earnedPrerequisites[firstFinal]?'Buy the prerequisite item and earn its upgrade through the required stacks or quest.':'First listed core item in the authored build.',provenance:observed.has(firstFinal)?'source-observed':own,available:true},
  boots.length?{id:'boots',title:'Boots window',buy:boots,chooseOne:[],note:'Buy boots when movement or defensive needs justify it; their inventory position is not a buy-order requirement.',provenance:own,available:true}:unavailable('boots','Boots window','This build does not include boots.'),
  later.length?{id:'later-core',title:'After the core',buy:later,chooseOne:[],note:'Remaining items in authored inventory order. Recheck the match before each major buy.',provenance:own,available:true}:unavailable('later-core','After the core','No further items after the first core.'),
  {id:'final',title:'Final build',buy:[...build.itemIds],chooseOne:[],note:'Six-item target. Earned upgrades export their buyable prerequisite.',provenance:collection==='meta-reference'?'source-observed':own,available:true},
 ];
 const runesObserved=!!build.meta?.crosschecks?.some(c=>c.observedRunePage.join()===build.runePage.join());
 return {
  id:`${collection}:${build.champion}:${build.id}`,collection,champion:build.champion,role:build.meta?normalizeRole(build.meta.role):'unspecified',
  name:build.name,category:build.category||(collection==='ceiling'?'Ability ceiling':collection==='meta-reference'?'Current meta reference':'Experiment'),goal:build.goal,summary:build.summary||build.hypothesis,
  patch:data.patch,dataVersion:data.version,checkedAt:build.meta?.checkedAt,sourceURL:build.meta?.sourceURL,
  finalItemIds:[...build.itemIds],runePage:[...build.runePage],shards:[...build.shards],
  stages:finish(data,stages),authoredPriorities:[...build.buyOrder],
  provenance:{items:collection==='meta-reference'?'source-observed':own,runes:runesObserved?'source-observed':own,order:own},
  limits:[...build.coverageNotes],
 };
}
export function planFromMeta(data:Catalog,build:FullMetaBuild):BuildPlan{
 validate(data,build.champion,build.itemIds,build.runePage,build.shards);
 const observed=(id:number)=>build.observedCoreItemIds.some(o=>o===id||earnedPrerequisites[o]===id);
 const stages:PurchaseStage[]=purchaseCheckpoints(data,build).map(point=>{
  const id=metaStageIds[point.title];if(!id)throw new BuildPlanError('stage-overlap',`Unknown purchase checkpoint ${point.title}.`);
  const buy=[...point.itemIds],chooseOne=[...(point.choiceIds||[])];
  return {id,title:point.title,buy,chooseOne,note:point.note,provenance:id==='first-core'&&buy.every(observed)?'source-observed':'inferred',available:buy.length+chooseOne.length>0};
 });
 stages.push({id:'final',title:'Final build',buy:[...build.itemIds],chooseOne:[],note:'Observed source core completed with reviewed inferred items. Earned upgrades export their buyable prerequisite.',provenance:'source-observed',available:true});
 const role=normalizeRole(build.role);
 return {
  id:`meta:${build.champion}:${role}:${build.sourceProvider}`,collection:'meta',champion:build.champion,role,
  name:`${build.role.toUpperCase()} meta plan`,category:'Current meta plan',goal:build.summary,summary:build.summary,
  patch:data.patch,dataVersion:data.version,checkedAt:build.checkedAt,sourceURL:build.sourceURL,
  finalItemIds:[...build.itemIds],runePage:[...build.runePage],shards:[...build.shards],
  stages:finish(data,stages),authoredPriorities:[],
  provenance:{items:'source-observed',runes:'source-observed',order:'inferred'},
  limits:[...build.warnings],
 };
}
export function planFromWorkspace(data:Catalog,champion:string,ids:number[],runes:number[],shards:number[],name:string,options:{order?:'authored'|'calculator'}={}):BuildPlan{
 validate(data,champion,ids,runes,shards);const order=options.order||'authored';
 return {
  id:`workspace:${champion}:${ids.join('-')}`,collection:'workspace',champion,role:'unspecified',name,category:'Test bench',goal:'Current test-bench setup.',summary:'Current test-bench setup.',
  patch:data.patch,dataVersion:data.version,finalItemIds:[...ids],runePage:[...runes],shards:[...shards],
  stages:finish(data,[{id:'final',title:'Final build',buy:[...ids],chooseOne:[],note:order==='calculator'?'Damage-calculated order for the selected objective, not a practical match order.':'Current equipped order.',provenance:order,available:true}]),
  authoredPriorities:[],provenance:{items:'authored',runes:'authored',order},
  limits:order==='calculator'?['Order maximizes the selected objective only; component stats, defensive utility and most procs are excluded.']:[],
 };
}
