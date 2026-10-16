import type {Catalog,Scenario} from './types';
import type {ProviderSource} from './provider-research';
import type {ChatBuild} from './chat-builds';
import {parseChatBuilds} from './chat-builds';
import {legalBuild} from './engine';
import {parseSave,validRunePage} from './storage';
import type {Save} from './storage';
export interface Baseline {ids:number[];names:string[];runePage?:number[];shards?:number[];source?:{provider:string;role:string;patch:string;checkedAt:string;matches:number;kind:'observed-core'}}
export interface WorkspaceDraft {version:1;save:Save;tab:string;activeBuild?:ChatBuild;baseline?:Baseline|null;manualOnly?:boolean}
export function comparisonScenario(scenario:Scenario,baseline:Baseline):Scenario{return {...scenario,runePage:baseline.runePage||scenario.runePage,shards:baseline.shards||scenario.shards}}
export function comparisonReady(scenario:Scenario,ids:number[],baseline:Baseline,data:Catalog):boolean{
 const legal=(values:number[])=>{const items=values.map(id=>data.items.find(i=>i.id===id));return items.every(Boolean)&&legalBuild(items as Catalog['items'],scenario.budget,scenario.slots,scenario.champion)};
 return ids.length===baseline.ids.length&&legal(ids)&&legal(baseline.ids)&&validRunePage(scenario.runePage,data.trees)&&validRunePage(baseline.runePage||scenario.runePage,data.trees);
}
export function providerBaseline(source:ProviderSource,data:Catalog):Baseline{
 if(source.status!=='available'||!source.observedCoreItemIds||!source.observedRunePage||!validRunePage(source.observedRunePage,data.trees))throw new Error('This reference has no validated core and rune page.');
 const items=source.observedCoreItemIds.map(id=>data.items.find(i=>i.id===id));
 if(items.some(i=>!i)||!legalBuild(items as Catalog['items'],100000,6,source.champion))throw new Error('This provider core contains conflicting or unavailable items.');
 return {ids:[...source.observedCoreItemIds],names:items.map(i=>i!.name),runePage:[...source.observedRunePage],source:{provider:source.provider==='opgg'?'OP.GG':'Lolalytics',role:source.role,patch:source.sourcePatch||'Unknown',checkedAt:source.checkedAt,matches:source.coreBuildMatches||0,kind:'observed-core'}};
}
export function parseWorkspaceDraft(text:string,data:Catalog):WorkspaceDraft{
 if(text.length>150000)throw new Error('Working draft is too large.');
 const input=JSON.parse(text);if(input.version!==1||!['Builds','Meta & teams','Test bench','Champion kit','Items','Runes','Data & coverage'].includes(input.tab))throw new Error('Invalid working draft.');
 const save=parseSave(JSON.stringify(input.save),data.champions,data.items);if(!validRunePage(save.scenario.runePage,data.trees))throw new Error('Invalid draft rune page.');
 if(input.manualOnly!==undefined&&typeof input.manualOnly!=='boolean')throw new Error('Invalid working model selection.');
 let activeBuild:ChatBuild|undefined;
 if(input.activeBuild){activeBuild=parseChatBuilds(JSON.stringify({version:1,patch:data.patch,builds:[input.activeBuild]}),data)[0];if(activeBuild.champion!==save.scenario.champion)throw new Error('Draft champion and proposal disagree.');}
 let baseline:Baseline|undefined;
 if(input.baseline){const b=input.baseline;const parsed=parseSave(JSON.stringify({...save,items:b.ids,scenario:{...save.scenario,budget:100000,slots:6,runePage:b.runePage||save.scenario.runePage,shards:b.shards||save.scenario.shards}}),data.champions,data.items);if(!validRunePage(parsed.scenario.runePage,data.trees))throw new Error('Invalid baseline rune page.');
  if(b.source&&(!['OP.GG','Lolalytics'].includes(b.source.provider)||b.source.kind!=='observed-core'||typeof b.source.role!=='string'||typeof b.source.patch!=='string'||typeof b.source.checkedAt!=='string'||!Number.isInteger(b.source.matches)||b.source.matches<0))throw new Error('Invalid baseline provenance.');
  baseline={ids:parsed.items,names:parsed.items.map(id=>data.items.find(i=>i.id===id)!.name),runePage:parsed.scenario.runePage,shards:parsed.scenario.shards,...(b.source?{source:b.source}:{})};
 }
 return {version:1,save,tab:input.tab,...(activeBuild?{activeBuild}:{}),...(baseline?{baseline}:{}),...(input.manualOnly===undefined?{}:{manualOnly:input.manualOnly})};
}
