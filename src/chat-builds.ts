import type {Catalog,Scenario} from './types';
import type {Save} from './storage';
import {defaultScenario} from './engine';
import {parseSave,validRunePage} from './storage';
export interface ChatBuild {id:string;champion:string;name:string;goal:string;hypothesis:string;summary?:string;category?:string;itemIds:number[];runePage:number[];shards:number[];conditions:Partial<Scenario>;testPlan:string[];failureConditions:string[];tradeoffs:string[];buyOrder:string[];coverageNotes:string[]}
export interface TestRecord{buildId:string;champion:string;name:string;date:string;outcome:string;measuredDamage:number|null;observations:string;scenario:Scenario;itemIds:number[]}
export function parseTestRecords(text:string,data:Catalog):{records:TestRecord[];rejected:number}{
 if(text.length>2000000)throw new Error('Test history is too large.');const input=JSON.parse(text);if(!Array.isArray(input))throw new Error('Expected a test history list.');let rejected=0;
 const records=input.filter(r=>{try{
  if(!r||typeof r.buildId!=='string'||!/^[a-z0-9-]{1,80}$/.test(r.buildId)||typeof r.name!=='string'||!r.name||r.name.length>4000||typeof r.date!=='string'||!Number.isFinite(Date.parse(r.date))||typeof r.observations!=='string'||r.observations.length>4000||!['not-sure','promising','mixed','failed'].includes(r.outcome))throw new Error('Invalid test text.');
  if(r.measuredDamage!==null&&(typeof r.measuredDamage!=='number'||!Number.isFinite(r.measuredDamage)||r.measuredDamage<0||r.measuredDamage>10000000))throw new Error('Invalid measured damage.');
  if(!Array.isArray(r.itemIds)||!r.scenario||r.champion!==r.scenario.champion)throw new Error('Invalid test setup.');
  const s=parseSave(JSON.stringify({version:1,patch:'26.20',scenario:r.scenario,items:r.itemIds}),data.champions,data.items);if(!validRunePage(s.scenario.runePage,data.trees))throw new Error('Invalid rune page.');return true;
 }catch{rejected++;return false;}}).slice(0,100);return {records,rejected};
}
export function toTestSave(build:ChatBuild,data:Catalog):Save{
 const cost=build.itemIds.reduce((sum,id)=>sum+(data.items.find(i=>i.id===id)?.gold.total||0),0);
 const scenario={...defaultScenario(build.champion),...build.conditions,champion:build.champion,budget:Math.max(18000,cost),slots:6,runePage:build.runePage,shards:build.shards};
 const save=parseSave(JSON.stringify({version:1,patch:'26.20',scenario,items:build.itemIds,notes:`${build.name}\nHypothesis: ${build.hypothesis}\nTest: ${build.testPlan.join(' ')}`}),data.champions,data.items);
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
  for(const key of ['testPlan','failureConditions','tradeoffs','buyOrder','coverageNotes'] as const){if(!Array.isArray(b[key])||!b[key].length||b[key].length>12||b[key].some(v=>typeof v!=='string'||!v.trim()||v.length>2000))throw new Error(`Invalid ${key}.`);}
  if(!Array.isArray(b.itemIds)||b.itemIds.length!==6||b.itemIds.some(id=>!Number.isInteger(id)))throw new Error('An authored build must contain six distinct item IDs.');
  if(!b.conditions||typeof b.conditions!=='object'||Array.isArray(b.conditions))throw new Error('Missing test conditions.');
  const allowed=Object.keys(defaultScenario()).filter(k=>!['champion','budget','slots','shards','runePage'].includes(k));
  if(Object.keys(b.conditions).some(k=>!allowed.includes(k)))throw new Error('Unexpected scenario condition.');
  toTestSave(b,data);return b;
 });
}
export function parseChampionBuilds(text:string,data:Catalog,champion:string):ChatBuild[]{
 const builds=parseChatBuilds(text,data);
 if(builds.length!==4||builds.some(b=>b.champion!==champion))throw new Error('Expected four builds for the selected champion.');
 return builds;
}
