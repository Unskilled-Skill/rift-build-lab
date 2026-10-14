import type {Catalog,Scenario} from './types';
import type {ChatBuild,TestRecord} from './chat-builds';
import {toTestSave} from './chat-builds';
export interface TestDraft {observations:string;measured:string;outcome:string;trials?:string;baselineMeasured?:string;targetSlot?:string;sequence?:string;procReadiness?:string;targetState?:string}
export function parseTrialValues(text:string):number[]{
 if(!text.trim())return [];
 const parts=text.trim().split(/[,\n]/);if(parts.length>100)throw new Error('Enter at most 100 trials.');
 return parts.map(part=>{const token=part.trim(),n=Number(token);if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)||!Number.isFinite(n)||n<0||n>10000000)throw new Error('Separate trial values with commas or new lines; each must be between 0 and 10,000,000.');return n});
}
export function trialSummary(values:number[]){if(!values.length)return null;const min=Math.min(...values),max=Math.max(...values);return {count:values.length,mean:values.reduce((sum,n)=>sum+n,0)/values.length,min,max,spread:max-min}}
export const emptyDraft=():TestDraft=>({observations:'',measured:'',outcome:'not-sure'});
export function parseTestDraft(text:string|null):TestDraft{
 try{const d=JSON.parse(text||'null');if(!d||typeof d.observations!=='string'||d.observations.length>4000||typeof d.measured!=='string'||d.measured.length>32||!['not-sure','promising','mixed','failed'].includes(d.outcome))return emptyDraft();const result:TestDraft={observations:d.observations,measured:d.measured,outcome:d.outcome};for(const key of ['trials','baselineMeasured','targetSlot','sequence','procReadiness','targetState'] as const){if(d[key]!==undefined){if(typeof d[key]!=='string'||d[key].length>(key==='trials'?4000:1000))return emptyDraft();result[key]=d[key]}}if(d.targetSlot&&!/^([PQWER](?::[0-9])?|combo)$/.test(d.targetSlot))return emptyDraft();return result}catch{return emptyDraft()}
}
export const visibleSlotCount=(slots:number,items:number[])=>Math.max(slots,items.length);
export function isModifiedSetup(build:ChatBuild,data:Catalog,scenario:Scenario,items:number[]):boolean{
 const expected=toTestSave(build,data);
 return JSON.stringify(items)!==JSON.stringify(expected.items)||Object.keys(expected.scenario).some(key=>JSON.stringify(scenario[key as keyof Scenario])!==JSON.stringify(expected.scenario[key as keyof Scenario]));
}
export function feedbackBrief(record:TestRecord):string{
 return `Revise the build ${record.name} (${record.buildId}) for ${record.champion} in my Rift Build Lab. Use this measured result and exact setup. Explain what changed and what to test next; do not assume a single test proves strength.\n${JSON.stringify(record)}`;
}
