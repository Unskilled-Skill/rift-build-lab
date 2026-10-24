import type {Catalog,Scenario} from './types';
import type {Save} from './storage';
import {defaultScenario} from './scenario';
import {parseSave,validRunePage} from './storage';
import {trialSummary} from './workflow';
export type CeilingMetric='single-hit'|'full-window'|'shield'|'heal'|'execute-threshold'|'stat';
export interface CeilingInfo{targetSlot:string;targetName:string;metric:CeilingMetric;damageType:string;finiteState:string;verification:'candidate'}
export const metricLabels:Record<string,string>={damage:'damage','single-hit':'single-hit damage','full-window':'full-window damage',shield:'shield',heal:'healing','execute-threshold':'execute threshold',stat:'stat value'};
export const isDamageMetric=(metric:string)=>['damage','single-hit','full-window'].includes(metric);
export const measuredValue=(r:TestRecord)=>r.measuredValue??r.measuredDamage;
export interface MetaCrosscheck{provider:string;sourceURL:string;sourcePatch:string;selection:string;observedCoreItemIds:number[];observedRunePage:number[];coreBuildMatches:number;checkedAt:string;limits:string}
export interface MetaInfo{crosschecks?:MetaCrosscheck[];role:string;sourceURL:string;sourceTitle:string;sourcePatch:string;checkedAt:string;sourceScope:string;matches:number;observedCoreItemIds:number[];observedFullItemIds:number[];inferredItemIds:number[];bootsId:number}
// Observed ranked source for a build taken from provider data (see scripts/ranked-references).
export interface RankedInfo{provider:'opgg'|'lolalytics';role:string;sourceURL:string;sourcePatch:string;checkedAt:string;games:number;winRate?:number;observedCoreItemIds:number[]}
export interface ChatBuild {id:string;champion:string;name:string;goal:string;hypothesis:string;summary?:string;category?:string;requiresManualTest?:boolean;ceiling?:CeilingInfo;meta?:MetaInfo;ranked?:RankedInfo;itemIds:number[];runePage:number[];shards:number[];conditions:Partial<Scenario>;testPlan:string[];failureConditions:string[];tradeoffs:string[];buyOrder:string[];coverageNotes:string[]}
export function snapshotTestProposal(build:ChatBuild):ChatBuild{return structuredClone(build)}
export interface TestRecord{proposal?:ChatBuild;buildId:string;champion:string;name:string;date:string;outcome:string;measuredDamage:number|null;measuredValue?:number|null;metric?:string;observations:string;scenario:Scenario;itemIds:number[];trialValues?:number[];baselineMeasured?:number;targetSlot?:string;sequence?:string;procReadiness?:string;targetState?:string}
export function parseTestRecords(text:string,data:Catalog):{records:TestRecord[];rejected:number}{
 if(text.length>2000000)throw new Error('Test history is too large.');const input=JSON.parse(text);if(!Array.isArray(input))throw new Error('Expected a test history list.');let rejected=0;
 const records=input.filter(r=>{try{
  if(!r||typeof r.buildId!=='string'||!/^[a-z0-9-]{1,80}$/.test(r.buildId)||typeof r.name!=='string'||!r.name||r.name.length>4000||typeof r.date!=='string'||!Number.isFinite(Date.parse(r.date))||typeof r.observations!=='string'||r.observations.length>4000||!['not-sure','promising','mixed','failed'].includes(r.outcome))throw new Error('Invalid test text.');
  if(r.measuredDamage!==null&&(typeof r.measuredDamage!=='number'||!Number.isFinite(r.measuredDamage)||r.measuredDamage<0||r.measuredDamage>10000000))throw new Error('Invalid measured damage.');
  if(r.metric!==undefined&&!Object.hasOwn(metricLabels,r.metric))throw new Error('Unknown measured metric.');
  if(r.measuredValue!==undefined&&r.measuredValue!==null&&(typeof r.measuredValue!=='number'||!Number.isFinite(r.measuredValue)||r.measuredValue<0||r.measuredValue>10000000))throw new Error('Invalid measured value.');
  if(r.metric!==undefined&&!isDamageMetric(r.metric)&&r.measuredDamage!==null)throw new Error('Non-damage metric cannot be recorded as damage.');
  if(r.metric!==undefined&&isDamageMetric(r.metric)&&r.measuredValue!==undefined&&r.measuredValue!==r.measuredDamage)throw new Error('Damage measurements disagree.');
  if(r.baselineMeasured!==undefined&&(typeof r.baselineMeasured!=='number'||!Number.isFinite(r.baselineMeasured)||r.baselineMeasured<0||r.baselineMeasured>10000000))throw new Error('Invalid baseline measurement.');
  if(r.trialValues!==undefined){if(!Array.isArray(r.trialValues)||!r.trialValues.length||r.trialValues.length>100||r.trialValues.some((n:unknown)=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>10000000))throw new Error('Invalid trials.');const mean=trialSummary(r.trialValues)!.mean;if(measuredValue(r)!==mean)throw new Error('Trial mean disagrees with measured value.');}
  if(r.targetSlot!==undefined&&(typeof r.targetSlot!=='string'||!/^([PQWER](?::[0-9])?|combo)$/.test(r.targetSlot)))throw new Error('Invalid test objective.');
  for(const k of ['sequence','procReadiness','targetState'])if(r[k]!==undefined&&(typeof r[k]!=='string'||r[k].length>1000))throw new Error('Invalid trial conditions.');
  if(r.proposal!==undefined){const proposal=parseChatBuilds(JSON.stringify({version:1,patch:data.patch,builds:[r.proposal]}),data)[0];if(proposal.id!==r.buildId||proposal.champion!==r.champion)throw new Error('Historical proposal does not match this result.');}
  if(!Array.isArray(r.itemIds)||!r.scenario||r.champion!==r.scenario.champion)throw new Error('Invalid test setup.');
  const s=parseSave(JSON.stringify({version:1,patch:'26.20',scenario:r.scenario,items:r.itemIds}),data.champions,data.items);if(!validRunePage(s.scenario.runePage,data.trees))throw new Error('Invalid rune page.');return true;
 }catch{rejected++;return false;}}).slice(0,100);return {records,rejected};
}
export function toTestSave(build:ChatBuild,data:Catalog):Save{
 const cost=build.itemIds.reduce((sum,id)=>sum+(data.items.find(i=>i.id===id)?.gold.total||0),0);
 const scenario={...defaultScenario(build.champion),...build.conditions,champion:build.champion,budget:Math.max(18000,cost),slots:6,runePage:build.runePage,shards:build.shards};
 const save=parseSave(JSON.stringify({version:1,patch:'26.20',scenario,items:build.itemIds,requiresManualTest:build.requiresManualTest,notes:`${build.name}\nHypothesis: ${build.hypothesis}\nTest: ${build.testPlan.join(' ')}`}),data.champions,data.items);
 if(!validRunePage(save.scenario.runePage,data.trees))throw new Error(`${build.name}: invalid rune page.`);
 return save;
}
export function parseChatBuilds(text:string,data:Catalog):ChatBuild[]{
 if(text.length>500000)throw new Error('Build inbox is too large.');const input=JSON.parse(text);
 if(input.version!==1||input.patch!=='26.20'||!Array.isArray(input.builds)||input.builds.length>100)throw new Error('Expected a patch 26.20 ChatGPT build inbox.');
 const ids=new Set<string>();return input.builds.map((b:ChatBuild)=>{
  if(!b||typeof b.id!=='string'||!/^[a-z0-9-]{1,80}$/.test(b.id)||ids.has(b.id))throw new Error('Invalid or duplicate build identifier.');ids.add(b.id);
  for(const key of ['champion','name','goal','hypothesis'] as const)if(typeof b[key]!=='string'||!b[key].trim()||b[key].length>4000)throw new Error(`Invalid build ${key}.`);
  for(const key of ['summary','category'] as const)if(b[key]!==undefined&&(typeof b[key]!=='string'||b[key]!.length>4000))throw new Error(`Invalid build ${key}.`);
  if(b.requiresManualTest!==undefined&&typeof b.requiresManualTest!=='boolean')throw new Error('Invalid test model flag.');
  if(b.ceiling){const c=b.ceiling;if(!b.requiresManualTest||c.verification!=='candidate'||!['P','Q','W','E','R'].includes(c.targetSlot)||!['single-hit','full-window','shield','heal','execute-threshold','stat'].includes(c.metric)||!['physical','magic','true','mixed','none'].includes(c.damageType)||typeof c.targetName!=='string'||!c.targetName.trim()||c.targetName.length>2000||typeof c.finiteState!=='string'||!c.finiteState.trim()||c.finiteState.length>2000)throw new Error('Invalid ability ceiling metadata.');}
  if(b.ranked!==undefined){const r=b.ranked;if(!r||!['opgg','lolalytics'].includes(r.provider)||!['top','jungle','mid','adc','support'].includes(r.role)||typeof r.sourceURL!=='string'||!/^https:\/\/(op\.gg|lolalytics\.com)\//.test(r.sourceURL)||typeof r.sourcePatch!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.checkedAt)||!Number.isInteger(r.games)||r.games<1||(r.winRate!==undefined&&!(r.winRate>=0&&r.winRate<=100))||!Array.isArray(r.observedCoreItemIds)||!r.observedCoreItemIds.length||r.observedCoreItemIds.some((id:number)=>!b.itemIds.includes(id)))throw new Error('Invalid ranked source.')}
  if(b.meta){const m=b.meta;if(!b.requiresManualTest||typeof m.sourceURL!=='string'||!/^https:\/\/mobalytics\.gg\/lol\/champions\/[a-z]+\/build(?:\/[a-z]+)?$/.test(m.sourceURL)||m.sourcePatch!=='16.20'||!Number.isInteger(m.matches)||m.matches<1)throw new Error('Invalid meta source.');for(const k of ['role','sourceTitle','checkedAt','sourceScope'] as const)if(typeof m[k]!=='string'||!m[k].trim()||m[k].length>2000)throw new Error('Invalid meta text.');for(const k of ['observedCoreItemIds','observedFullItemIds','inferredItemIds'] as const)if(!Array.isArray(m[k])||new Set(m[k]).size!==m[k].length||m[k].some(id=>!data.items.some(i=>i.id===id)))throw new Error('Invalid meta items.');if(m.observedCoreItemIds.length!==2||!m.observedFullItemIds.includes(m.bootsId)||m.observedCoreItemIds.some(id=>!b.itemIds.includes(id)||!m.observedFullItemIds.includes(id))||m.inferredItemIds.some(id=>!b.itemIds.includes(id)||m.observedFullItemIds.includes(id))||b.itemIds.some(id=>m.inferredItemIds.includes(id)!==!m.observedFullItemIds.includes(id)))throw new Error('Invalid meta provenance.');if(m.crosschecks!==undefined){if(!Array.isArray(m.crosschecks)||m.crosschecks.length>3)throw new Error('Invalid crosschecks.');for(const c of m.crosschecks){if(!['opgg','lolalytics'].includes(c.provider)||typeof c.sourceURL!=='string'||!/^https:\/\/(?:op\.gg\/open-source\/opgg-mcp|lolalytics\.com\/lol\/[a-z]+\/build\/)(?:\?lane=[a-z]+)?$/.test(c.sourceURL)||c.sourcePatch!=='16.20'||!Number.isInteger(c.coreBuildMatches)||c.coreBuildMatches<1)throw new Error('Invalid crosscheck source.');for(const k of ['selection','checkedAt','limits'] as const)if(typeof c[k]!=='string'||!c[k].trim()||c[k].length>2000)throw new Error('Invalid crosscheck text.');if(!Array.isArray(c.observedCoreItemIds)||c.observedCoreItemIds.length>8||c.observedCoreItemIds.some(id=>!data.items.some(i=>i.id===id))||!Array.isArray(c.observedRunePage)||c.observedRunePage.length!==6||c.observedRunePage.some(id=>!data.runes.some(r=>r.id===id)))throw new Error('Invalid crosscheck IDs.');}}}
  for(const key of ['testPlan','failureConditions','tradeoffs','buyOrder','coverageNotes'] as const){if(!Array.isArray(b[key])||!b[key].length||b[key].length>12||b[key].some(v=>typeof v!=='string'||!v.trim()||v.length>2000))throw new Error(`Invalid ${key}.`);}
  if(!Array.isArray(b.itemIds)||b.itemIds.length!==6||b.itemIds.some(id=>!Number.isInteger(id)))throw new Error('An authored build must contain six distinct item IDs.');
  if(!b.conditions||typeof b.conditions!=='object'||Array.isArray(b.conditions))throw new Error('Missing test conditions.');
  const allowed=[...Object.keys(defaultScenario()),'objectiveSlot','critMode','spellbladeReady','targetHealthPercent','procReady','gatheringMinutes','firstStrikeReady'].filter(k=>!['champion','budget','slots','shards','runePage'].includes(k));
  if(Object.keys(b.conditions).some(k=>!allowed.includes(k)))throw new Error('Unexpected scenario condition.');
  toTestSave(b,data);return b;
 });
}
export function parseChampionBuilds(text:string,data:Catalog,champion:string):ChatBuild[]{
 const builds=parseChatBuilds(text,data);
 if(builds.length!==4||builds.some(b=>b.champion!==champion))throw new Error('Expected four builds for the selected champion.');
 return builds;
}
