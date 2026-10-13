import type {Catalog,Champion,Item,RuneTree,Scenario} from './types';
import {defaultScenario,legalBuild} from './engine';
export interface Save {version:1;patch:'26.20';scenario:Scenario;items:number[];notes?:string;requiresManualTest?:boolean}
export function validRunePage(ids:number[],trees:RuneTree[]){if(ids.length!==6||new Set(ids).size!==6)return false;const primary=trees.find(t=>t.slots[0].runes.some(r=>r.id===ids[0]));if(!primary||!ids.slice(0,4).every((id,n)=>primary.slots[n].runes.some(r=>r.id===id)))return false;const secondary=trees.find(t=>t.id!==primary.id&&t.slots.slice(1).some(slot=>slot.runes.some(r=>r.id===ids[4])));if(!secondary)return false;const rows=ids.slice(4).map(id=>secondary.slots.findIndex(slot=>slot.runes.some(r=>r.id===id)));return rows.every(n=>n>0)&&rows[0]!==rows[1];}
export function parseSave(text:string,champions:Champion[],items:Item[]):Save{
 if(text.length>100000)throw new Error('Import is too large.');const input=JSON.parse(text);
 if(input.version!==1||input.patch!=='26.20'||!input.scenario||!Array.isArray(input.items))throw new Error('Expected a patch 26.20 Build Lab scenario.');
 const s=input.scenario;const champion=champions.find(c=>c.alias===s.champion);if(!champion)throw new Error('Unknown champion.');
 const bounds:Record<string,[number,number]>={level:[1,18],rank:[1,['Jayce','Udyr'].includes(s.champion)?6:5],eRank:[1,5],mr:[-1000,10000],armor:[-1000,10000],targetHP:[1,100000],duration:[.25,60],mana:[0,100000],grit:[0,100000],extraAP:[0,10000],extraAD:[0,10000],extraHP:[0,100000],healthPercent:[1,100],bloodmailBonus:[0,12],rodStacks:[0,10],heartsteelHP:[0,10000],conquerorStacks:[0,12],combatSeconds:[0,60],budget:[0,100000],slots:[1,6]};
 for(const [key,[min,max]] of Object.entries(bounds)){if(typeof s[key]!=='number'||!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw new Error(`Invalid ${key}.`);}
 if(!['fraction','absolute'].includes(s.gritMode)||!['q','e','qe','sequence','w'].includes(s.mode)||typeof s.poisoned!=='boolean'||typeof s.center!=='boolean')throw new Error('Invalid scenario mode.');
 if(['level','rank','eRank','rodStacks','conquerorStacks','slots'].some(k=>!Number.isInteger(s[k])))throw new Error('Ranks, levels and stack counts must be integers.');
 if(s.gritMode==='fraction'&&s.grit>100)throw new Error('Grit fraction cannot exceed 100%.');
 if((s.champion==='Sett'&&s.mode!=='w')||(s.champion==='Cassiopeia'&&s.mode==='w'))throw new Error('Ability mode does not match the champion.');
 const shardRows=[[5005,5007,5008],[5008,5010,5001],[5011,5013,5001]];
 if(!Array.isArray(s.shards)||s.shards.length!==3||s.shards.some((id:number,n:number)=>!shardRows[n].includes(id)))throw new Error('Invalid stat-shard row.');
 if(!Array.isArray(s.runePage)||s.runePage.length!==6||s.runePage.some((id:number)=>!Number.isInteger(id)))throw new Error('Invalid rune page.');
 const selected=input.items.map((id:number)=>items.find(i=>i.id===id));
 if(selected.some((i:Item|undefined)=>!i)||!legalBuild(selected,s.budget,s.slots,s.champion))throw new Error('Unknown or illegal items for this budget and slot count.');
 if(input.requiresManualTest!==undefined&&typeof input.requiresManualTest!=='boolean')throw new Error('Invalid model coverage flag.');
 if(input.notes!==undefined&&typeof input.notes!=='string')throw new Error('Notes must be text.');
 return {version:1,patch:'26.20',scenario:{...defaultScenario(s.champion),...Object.fromEntries(Object.keys(defaultScenario()).map(k=>[k,s[k]]))},items:[...input.items],notes:input.notes?.slice(0,2000),...(input.requiresManualTest===undefined?{}:{requiresManualTest:input.requiresManualTest})};
}

export function partitionSavedHistory(input:unknown,data:Catalog):{valid:Save[];rejected:unknown[]}{
 if(!Array.isArray(input))throw new Error('Expected saved scenario list.');
 const valid:Save[]=[],rejected:unknown[]=[];
 for(const entry of input){try{const save=parseSave(JSON.stringify(entry),data.champions,data.items);if(!validRunePage(save.scenario.runePage,data.trees))throw new Error('Invalid rune page.');valid.push(save)}catch{rejected.push(entry)}}
 return {valid:valid.slice(0,20),rejected};
}
