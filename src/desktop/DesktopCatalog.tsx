import {useState} from 'react';
import type {ReactNode} from 'react';

export function catalogPage(total:number,requested:number){
 const size=32,pages=Math.max(1,Math.ceil(total/size)),page=Math.min(pages-1,Math.max(0,requested));
 return {start:page*size,end:Math.min(total,(page+1)*size),page,pages};
}
/** Desktop only: bound live card DOM and decoded artwork while searching all records. */
export default function DesktopCatalog<T>({entries,kind,className,render}:{entries:T[];kind:'items'|'runes';className:string;render:(entry:T)=>ReactNode}){
 const [requested,setPage]=useState(0),range=catalogPage(entries.length,requested);
 const label=kind==='items'?'Items':'Runes';
 return <>
  <nav className="desktop-catalog-pages" aria-label={`${label} catalog pages`}>
   <span role="status">{entries.length?range.start+1:0}–{range.end} of {entries.length} {kind}</span>
   <div><button className="secondary" disabled={range.page===0} onClick={()=>setPage(range.page-1)}>Previous</button>
   <label>Page <select aria-label={`${label} catalog page`} value={range.page} onChange={e=>setPage(Number(e.target.value))}>{Array.from({length:range.pages},(_,page)=><option key={page} value={page}>{page+1} of {range.pages}</option>)}</select></label>
   <button className="secondary" disabled={range.page===range.pages-1} onClick={()=>setPage(range.page+1)}>Next</button></div>
  </nav>
  <div className={className}>{entries.slice(range.start,range.end).map(render)}</div>
 </>;
}
