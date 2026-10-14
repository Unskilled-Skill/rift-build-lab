import type {Catalog} from './types';
import type {ProviderSource} from './provider-research';
import {parseProviderResearch} from './provider-research';
import type {MetaPlan} from './meta-recommendations';
const roles=['top','jungle','mid','adc','support'];
export interface RoleIndex{version:1;patch:string;checkedAt:string;recordsDirectory:string;champions:Record<string,string[]>}
export function parseRoleIndex(value:unknown,data:Catalog):RoleIndex{
 const i=value as RoleIndex;if(!i||i.version!==1||i.patch!==data.patch||!/^versions\/[a-f0-9-]{36}$/.test(i.recordsDirectory)||!/^\d{4}-\d{2}-\d{2}$/.test(i.checkedAt)||!i.champions||typeof i.champions!=='object'||Array.isArray(i.champions))throw Error('Invalid optional-role index.');
 for(const [champion,list]of Object.entries(i.champions))if(!data.champions.some(c=>c.alias===champion)||!Array.isArray(list)||!list.length||list.length>5||new Set(list).size!==list.length||list.some(r=>!roles.includes(r)))throw Error('Invalid optional-role availability.');return i;
}
export function parseRoleSources(value:unknown,data:Catalog,champion:string):Array<{role:string;sources:ProviderSource[]}>{
 const v=value as {version:number;patch:string;champion:string;roles:Array<{role:string;sources:ProviderSource[]}>};if(!v||v.version!==1||v.patch!==data.patch||v.champion!==champion||!Array.isArray(v.roles)||v.roles.length>5||new Set(v.roles.map(r=>r.role)).size!==v.roles.length)throw Error('Invalid alternate-role observations.');
 return v.roles.map(r=>{const sources=parseProviderResearch(JSON.stringify({version:1,patch:data.patch,champion,sources:r.sources}),data,champion);if(!roles.includes(r.role)||sources.some(s=>s.role!==r.role||s.status!=='available'||s.coreBuildMatches!<100||s.provider==='lolalytics'&&s.matches!<1000))throw Error('Alternate role lacks qualified source evidence.');return {role:r.role,sources}});
}
// Explicit kit-reviewed late-slot pools for the qualified alternate roles.
// Source cores and boots are acquired independently; these are inferred completions.
const completions:Record<string,number[]>={
 'Gragas/jungle':[3089,3135,3157,3102,4645], 'Hwei/adc':[3089,3135,3157,3102,3165],
 'Lux/mid':[3089,3135,3157,3102,4645], 'Maokai/jungle':[3065,3075,2502,6665,2504],
 'Pantheon/mid':[6694,3814,3026,3156,6609], 'Poppy/top':[3053,3065,2502,3075,6665,3143],
 'Poppy/jungle':[3065,2502,3075,6665,3143,2504], 'Seraphine/adc':[3089,3135,3157,3165,3102],
 'Swain/mid':[3157,3065,3135,3089,3165], 'Swain/adc':[3157,3065,3135,3089,3165],
 'TahmKench/support':[3869,3190,3109,3065,2504,3143], 'Taliyah/jungle':[3089,3135,3157,3102,3165],
 'Tristana/mid':[3036,3072,3026,3033,3156], 'Vayne/top':[3091,3026,3033,3072,3156],
 'Velkoz/mid':[3135,3089,3157,3165,3102], 'Yasuo/adc':[3072,3026,3036,6333,3156],
 'Yone/mid':[6333,3026,3072,3036,3156], 'Ziggs/mid':[3089,3135,3157,3102,3165]
};
export function roleMetaPlan(base:MetaPlan,role:string):MetaPlan{
 if(base.role===role)return base;const pool=completions[`${base.champion}/${role}`];if(!pool)throw Error('No reviewed completion for this role.');
 const quests=[3869,3870,3871,3876,3877];const retain=base.preferredItemIds.filter(id=>role==='support'||!quests.includes(id));
 return {...base,role,preferredItemIds:[...new Set([...pool,...retain])],situationalItemIds:base.situationalItemIds.filter(id=>role==='support'||!quests.includes(id)),notes:[...base.notes.filter(n=>!n.startsWith('OP.GG observed core')&&!n.startsWith('Early Tear/Dark Seal')),`Alternate ${role} role: source core and runes are observed; late completion is a separately reviewed kit inference, not an observed six-item cohort.`]};
}
