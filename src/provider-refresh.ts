export interface RefreshStatus{available:true;state:'idle'|'running'|'complete'|'failed';completed:number;total:number;due:boolean;intervalHours:number;jobId?:string;startedAt?:string;finishedAt?:string;lastSuccessfulAt?:string|null;error?:string;sourcePatches:Record<string,string[]>}
export function parseRefreshStatus(value:unknown):RefreshStatus{
 if(!value||typeof value!=='object')throw new Error('Live updates need the local app server.');const s=value as RefreshStatus;
 if(s.available!==true||!['idle','running','complete','failed'].includes(s.state)||!Number.isInteger(s.completed)||!Number.isInteger(s.total)||s.total<1||s.total>1000||s.completed<0||s.completed>s.total||typeof s.due!=='boolean'||s.intervalHours!==24)throw new Error('Invalid refresh status.');
 for(const k of ['startedAt','finishedAt','lastSuccessfulAt'] as const)if(s[k]!==undefined&&s[k]!==null&&(typeof s[k]!=='string'||!Number.isFinite(Date.parse(s[k]!))))throw new Error('Invalid refresh timestamp.');
 if(s.error!==undefined&&(typeof s.error!=='string'||s.error.length>1000))throw new Error('Invalid refresh error.');
 if(!s.sourcePatches||typeof s.sourcePatches!=='object'||Array.isArray(s.sourcePatches)||Object.entries(s.sourcePatches).some(([key,patches])=>!['opgg','lolalytics'].includes(key)||!Array.isArray(patches)||patches.length>5||patches.some(p=>typeof p!=='string'||!/^\d+\.\d+$/.test(p))))throw new Error('Invalid source patch metadata.');return s;
}
