import {it,expect} from 'vitest';
import {parseRefreshStatus} from '../src/provider-refresh';
const status={available:true,state:'running',completed:30,total:173,due:false,intervalHours:24,jobId:'abc',startedAt:'2026-10-13T22:00:00Z',lastSuccessfulAt:'2026-10-12T22:00:00Z',sourcePatches:{opgg:['16.20'],lolalytics:['16.20']}};
it('validates progress, timestamps and server freshness flags',()=>{expect(parseRefreshStatus(status).completed).toBe(30);expect(parseRefreshStatus({...status,state:'complete',completed:173}).state).toBe('complete')});
it('rejects bogus status, progress, errors and patch metadata',()=>{for(const change of [{completed:174},{total:0},{state:'done'},{lastSuccessfulAt:'yesterday'},{due:'true'},{error:'x'.repeat(3000)},{sourcePatches:{opgg:['not-a-patch']}}])expect(()=>parseRefreshStatus({...status,...change})).toThrow()});
