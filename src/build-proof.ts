import {legalBuild} from './build-rules';
import type {Catalog} from './types';
// How close a build is to what ranked Emerald+ players of this champion actually buy and run (item-timing.json).
export type ProofLevel='proven'|'adapted'|'experimental';
export interface BuildProof {level:ProofLevel;seen:number;total:number;core:number;keystone:boolean;usualKeystone?:number}
export const proofLabels:Record<ProofLevel,string>={proven:'Proven',adapted:'Adapted',experimental:'Experimental'};
const MIN_MATCHES=500;
// Proven: the ranked build itself, or two core items, the usual keystone and at most one unseen item.
// Adapted: keeps at least one core item and mostly items ranked players buy. Experimental: everything else.
export function buildProof(data:Catalog,champion:string,itemIds:number[],runePage:number[],ranked=false):BuildProof|undefined{
 const own=data.itemTiming?.champions[champion],keystones=data.itemTiming?.keystones?.[champion];
 if(!own||!keystones?.length)return undefined;
 const items=itemIds.filter(id=>!data.items.find(i=>i.id===id)?.tags.includes('Boots'));
 const seen=items.filter(id=>(own[id]?.matches||0)>=MIN_MATCHES).length;
 const core=items.filter(id=>(own[id]?.matches||0)>=MIN_MATCHES&&own[id].slot<=3.5).length;
 const keystone=keystones.some(k=>k.id===runePage[0]);
 const level:ProofLevel=ranked||core>=2&&keystone&&items.length-seen<=1?'proven':core>=1&&seen*2>=items.length?'adapted':'experimental';
 return {level,seen,total:items.length,core,keystone,...(keystone?{}:{usualKeystone:keystones[0].id})};
}
export function proofSummary(data:Catalog,champion:string,proof:BuildProof):string{
 const name=data.champions.find(c=>c.alias===champion)?.name||champion,rune=(id:number)=>data.runes.find(r=>r.id===id)?.name||String(id);
 const items=`${proof.seen} of ${proof.total} items appear on ${name} in ranked Emerald+ games`;
 return proof.keystone?`${items}, with a keystone ranked players use.`:`${items}. The keystone is not one ranked ${name} players use; they usually take ${rune(proof.usualKeystone!)}.`;
}
export interface SafeVariant {itemIds:number[];runePage:number[];shards:number[];swaps:{from:number;to:number}[];runesChanged:boolean;proof:BuildProof}
// Keeps the items ranked players buy plus the build's first two unseen "idea" items; fills the other slots with the
// champion's most-bought legal completed items (a core item first if none is left), and swaps an off-path keystone
// for the most-played ranked page.
export function rankedSafeVariant(data:Catalog,champion:string,itemIds:number[],runePage:number[],shards:number[]):SafeVariant|undefined{
 const proof=buildProof(data,champion,itemIds,runePage);
 const own=data.itemTiming?.champions[champion];
 if(!proof||proof.level==='proven'||!own)return undefined;
 const item=(id:number)=>data.items.find(i=>i.id===id);
 const boot=(id:number)=>!!item(id)?.tags.includes('Boots'),seen=(id:number)=>(own[id]?.matches||0)>=MIN_MATCHES;
 const idea=itemIds.filter(id=>!boot(id)&&!seen(id)).slice(0,2);
 const drop=itemIds.filter(id=>!boot(id)&&!seen(id)&&!idea.includes(id));
 const candidates=Object.entries(own).map(([id,e])=>({id:Number(id),...e})).filter(c=>c.matches>=MIN_MATCHES&&!itemIds.includes(c.id)&&!boot(c.id)&&!/^(32|66)\d{4}$/.test(String(c.id))&&(item(c.id)?.gold.total||0)>=2000).sort((a,b)=>b.matches-a.matches);
 const out=[...itemIds],swaps:SafeVariant['swaps']=[];
 for(const from of drop){
  const at=out.indexOf(from);
  const fits=(c:{id:number})=>!out.includes(c.id)&&legalBuild(out.map((id,n)=>n===at?c.id:id).map(id=>item(id)!),100000,6,champion);
  // Anchor on a ranked core item first when the build has none left.
  const coreless=!out.some(id=>!boot(id)&&seen(id)&&own[id].slot<=3.5);
  const next=(coreless?candidates.find(c=>c.slot<=3.5&&fits(c)):undefined)??candidates.find(fits);
  if(next){out[at]=next.id;swaps.push({from,to:next.id})}
 }
 const page=proof.keystone?undefined:data.itemTiming?.pages?.[champion];
 if(!swaps.length&&!page)return undefined;
 const runes=page?[...page.runePage]:[...runePage],stats=page?[...page.shards]:[...shards];
 return {itemIds:out,runePage:runes,shards:stats,swaps,runesChanged:!!page,proof:buildProof(data,champion,out,runes)!};
}
