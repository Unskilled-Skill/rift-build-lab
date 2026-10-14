import type {Catalog} from './types';
import {validRunePage} from './storage';
export interface ProviderItemOption {id:number;matches?:number;winRate?:number}
export interface ProviderItemOptions {slot:number;items:ProviderItemOption[]}
export interface ProviderSource {champion:string;role:string;provider:'opgg'|'lolalytics';status:'available'|'unavailable';sourceURL:string;sourcePatch?:string;checkedAt:string;selection?:string;observedCoreItemIds?:number[];observedItemOptions?:ProviderItemOptions[];observedShards?:number[];observedRunePage?:number[];coreBuildMatches?:number;coreBuildWins?:number;keystoneMatches?:number|null;keystoneWinRate?:number|null;coreBuildWinRate?:number;matches?:number|null;bootsId?:number|null;limits:string;error?:string}
export function parseProviderResearch(text:string,data:Catalog,champion:string):ProviderSource[]{
 if(text.length>100000)throw new Error('Provider snapshot is too large.');const input=JSON.parse(text);
 if(input.version!==1||input.patch!==data.patch||input.champion!==champion||!data.champions.some(c=>c.alias===champion)||!Array.isArray(input.sources)||input.sources.length!==2)throw new Error('Expected two provider references for this champion.');
 const providers=new Set<string>();
 return input.sources.map((s:ProviderSource)=>{
  if(!s||s.champion!==champion||!['opgg','lolalytics'].includes(s.provider)||providers.has(s.provider)||!['available','unavailable'].includes(s.status))throw new Error('Invalid provider identity.');providers.add(s.provider);
  for(const key of ['role','checkedAt','limits'] as const)if(typeof s[key]!=='string'||!s[key].trim()||s[key].length>2000)throw new Error('Invalid provider text.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s.checkedAt)||typeof s.sourceURL!=='string')throw new Error('Invalid checked date/link.');
  const expected=s.provider==='opgg'?'https://op.gg/open-source/opgg-mcp':`https://lolalytics.com/lol/${champion==='MonkeyKing'?'wukong':champion.toLowerCase()}/build/`;
  if(s.sourceURL!==expected&&!(s.provider==='lolalytics'&&['top','middle','bottom','support','jungle'].some(role=>s.sourceURL===`${expected}?lane=${role}`)))throw new Error('Unsafe provider link.');
  if(s.status==='unavailable'){if(typeof s.error!=='string'||!s.error.trim()||s.error.length>1000||s.coreBuildMatches!==undefined)throw new Error('Invalid unavailable record.');return s}
  if(!['top','mid','adc','jungle','support'].includes(s.role)||typeof s.sourcePatch!=='string'||!/^\d+\.\d+$/.test(s.sourcePatch)||typeof s.selection!=='string'||!s.selection.trim()||s.selection.length>300)throw new Error('Missing source context.');
  if(!Array.isArray(s.observedCoreItemIds)||s.observedCoreItemIds.length<1||s.observedCoreItemIds.length>8||new Set(s.observedCoreItemIds).size!==s.observedCoreItemIds.length||s.observedCoreItemIds.some(id=>!data.items.some(i=>i.id===id)))throw new Error('Invalid observed core.');
  if(s.observedItemOptions!==undefined){const rows=s.observedItemOptions;if(!Array.isArray(rows)||rows.length>3||new Set(rows.map(r=>r?.slot)).size!==rows.length||rows.some(r=>!r||![4,5,6].includes(r.slot)||!Array.isArray(r.items)||!r.items.length||r.items.length>50||new Set(r.items.map(i=>i?.id)).size!==r.items.length||r.items.some(i=>!i||!Number.isInteger(i.id)||!data.items.some(item=>item.id===i.id)||(i.matches!==undefined&&(!Number.isInteger(i.matches)||i.matches<1||i.matches>100000000))||(i.winRate!==undefined&&(!Number.isFinite(i.winRate)||i.winRate<0||i.winRate>100)))))throw new Error('Invalid marginal item options.');}
  const shardRows=[[5005,5007,5008],[5008,5010,5001],[5011,5013,5001]];if(s.observedShards!==undefined&&(!Array.isArray(s.observedShards)||s.observedShards.length!==3||s.observedShards.some((id,n)=>!shardRows[n].includes(id))))throw new Error('Invalid observed shard rows.');
  if(!Array.isArray(s.observedRunePage)||!validRunePage(s.observedRunePage,data.trees))throw new Error('Invalid observed rune page.');
  for(const k of ['coreBuildMatches','coreBuildWins','matches','keystoneMatches'] as const)if((k==='coreBuildMatches'||s[k]!==undefined&&s[k]!==null)&&(!Number.isInteger(s[k])||(s[k] as number)<(k==='coreBuildMatches'?1:0)||(s[k] as number)>100000000))throw new Error('Invalid provider sample count.');
  if(s.coreBuildWins!==undefined&&s.coreBuildWins>s.coreBuildMatches!)throw new Error('Wins exceed sample.');
  if(s.coreBuildWinRate!==undefined&&(!Number.isFinite(s.coreBuildWinRate)||s.coreBuildWinRate<0||s.coreBuildWinRate>100))throw new Error('Invalid provider win rate.');
  if(s.keystoneWinRate!==undefined&&s.keystoneWinRate!==null&&(!Number.isFinite(s.keystoneWinRate)||s.keystoneWinRate<0||s.keystoneWinRate>100))throw new Error('Invalid keystone win rate.');
  if(s.bootsId!==undefined&&s.bootsId!==null&&!data.items.some(i=>i.id===s.bootsId))throw new Error('Unknown boots.');return s;
 });
}
export interface ProviderIndex{version:1;patch:string;championCount:number;checkedAt:string;updatedAt?:string;recordsDirectory?:string}
export function parseProviderIndex(value:unknown,data:Catalog):ProviderIndex{
 if(!value||typeof value!=='object')throw new Error('Missing provider index.');const index=value as ProviderIndex;
 if(index.version!==1||index.patch!==data.patch||index.championCount!==data.champions.length||typeof index.checkedAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(index.checkedAt))throw new Error('Provider index does not match this catalog.');
 if(index.updatedAt!==undefined&&(typeof index.updatedAt!=='string'||!Number.isFinite(Date.parse(index.updatedAt))))throw new Error('Invalid publication timestamp.');
 if(index.recordsDirectory!==undefined&&(typeof index.recordsDirectory!=='string'||!/^versions\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(index.recordsDirectory)))throw new Error('Invalid snapshot directory.');return index;
}
