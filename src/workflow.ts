import type {Catalog,Scenario} from './types';
import type {ChatBuild,TestRecord} from './chat-builds';
import {toTestSave} from './chat-builds';
export interface TestDraft {observations:string;measured:string;outcome:string}
export const emptyDraft=():TestDraft=>({observations:'',measured:'',outcome:'not-sure'});
export function parseTestDraft(text:string|null):TestDraft{
 try{const d=JSON.parse(text||'null');if(!d||typeof d.observations!=='string'||d.observations.length>4000||typeof d.measured!=='string'||d.measured.length>32||!['not-sure','promising','mixed','failed'].includes(d.outcome))return emptyDraft();return {observations:d.observations,measured:d.measured,outcome:d.outcome}}catch{return emptyDraft()}
}
export const visibleSlotCount=(slots:number,items:number[])=>Math.max(slots,items.length);
export function isModifiedSetup(build:ChatBuild,data:Catalog,scenario:Scenario,items:number[]):boolean{
 const expected=toTestSave(build,data);
 return JSON.stringify(items)!==JSON.stringify(expected.items)||Object.keys(expected.scenario).some(key=>JSON.stringify(scenario[key as keyof Scenario])!==JSON.stringify(expected.scenario[key as keyof Scenario]));
}
export function feedbackBrief(record:TestRecord):string{
 return `Revise the build ${record.name} (${record.buildId}) for ${record.champion} in my Rift Build Lab. Use this measured result and exact setup. Explain what changed and what to test next; do not assume a single test proves strength.\n${JSON.stringify(record)}`;
}
