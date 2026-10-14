import {useEffect,useState} from 'react';
import {appPath} from './hosting';
import {parseProviderIndex} from './provider-research';
import type {Catalog} from './types';
export default function DataFreshness({data}:{data:Catalog}){
 const [checkedAt,setCheckedAt]=useState('Checking…');
 useEffect(()=>{const c=new AbortController();fetch(appPath('/data/provider-research/index.json'),{signal:c.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(raw=>setCheckedAt(parseProviderIndex(raw,data).checkedAt)).catch(()=>{if(!c.signal.aborted)setCheckedAt('Unavailable — open meta references to retry')});return()=>c.abort()},[data]);
 return <div className="data-freshness"><span>Formulas: patch {data.patch} · snapshot 10 Oct 2026</span><span>Meta references checked: {checkedAt}</span><span>Authored builds: patch {data.patch} · unvalidated</span></div>;
}
