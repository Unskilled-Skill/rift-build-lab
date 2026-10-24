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
