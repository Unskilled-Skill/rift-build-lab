import {useState} from 'react';
import {Download} from 'lucide-react';
import type {Catalog} from './types';
import type {PurchaseCheckpoint} from './purchase-checkpoints';
import type {LeagueExportSetup} from './league-export';
import {createLeagueItemSet,downloadLeagueJSON} from './league-export';
export default function LeagueImportActions({data,setup,checkpoints=[]}:{data:Catalog;setup:LeagueExportSetup;checkpoints?:PurchaseCheckpoint[]}){
 const [message,setMessage]=useState(''),[error,setError]=useState('');
 const exportItems=()=>{try{downloadLeagueJSON(createLeagueItemSet(data,setup,checkpoints),`rift-build-lab-${setup.champion.toLowerCase()}-items.json`);setMessage('Item set downloaded. Import this file in the League client’s Collection → Items section.');setError('')}catch(e){setError(e instanceof Error?e.message:'Could not export this item set.');setMessage('')}};
 return <section className="league-import" aria-label="Use this build in League"><div className="league-import-actions"><button className="secondary" disabled={!setup.itemIds.length} onClick={exportItems}><Download size={16}/>Download League item set</button></div><details><summary>How to import into League</summary><ol><li>Download the item-set JSON file.</li><li>In the League client, open Collection → Items and use the item-set import control to select the downloaded file.</li><li>Choose the set in the in-game shop for this champion on Summoner’s Rift.</li></ol><p className="footnote">Earned upgrades export their buyable prerequisite. Complete the required stacks or quest in game. An item-set file does not select your runes.</p></details>{message&&<p role="status" className="footnote">{message}</p>}{error&&<p role="alert" className="warning">{error}</p>}</section>;
}
