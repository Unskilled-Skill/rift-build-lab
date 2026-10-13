import {recoverProviderPublication} from '../scripts/prepare-provider-research.mjs';
import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {randomUUID} from 'node:crypto';
export const DAY=24*60*60*1000,RETRY=30*60*1000;
export function refreshDue(s,now=Date.now()){if(s.state==='running')return false;if(s.state==='failed'&&now-Date.parse(s.finishedAt||'')<RETRY)return false;return !s.lastSuccessfulAt||!Number.isFinite(Date.parse(s.lastSuccessfulAt))||now-Date.parse(s.lastSuccessfulAt)>=DAY;}
function readIndex(root){try{return JSON.parse(fs.readFileSync(path.join(root,'public/data/provider-research/index.json'),'utf8'))}catch{return {}}}
function runProcess(command,args,root,onLine,onChild){return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:root,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});onChild(child);const timer=setTimeout(()=>{child.kill();reject(new Error('Update timed out; the previous published data is retained.'))},20*60*1000);timer.unref();let tail='',pending='';const receive=chunk=>{const text=chunk.toString();tail=(tail+text).slice(-2000);pending+=text;const lines=pending.split(/\r?\n/);pending=lines.pop();for(const l of lines)onLine(l)};child.stdout.on('data',receive);child.stderr.on('data',receive);child.once('error',e=>{clearTimeout(timer);reject(new Error(`Could not start the local collector: ${e.message}`))});child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(tail.trim()||`Collector exited with code ${code}.`))})});}
export function createRefreshService(root,{now=Date.now,run}={}){
 recoverProviderPublication(root);
 const directory=path.join(root,'data/provider-refresh');fs.mkdirSync(directory,{recursive:true});const stateFile=path.join(directory,'status.json');let state={state:'idle',completed:0,total:readIndex(root).championCount||173},active=null,child=null,cancelled=false;
 try{const saved=JSON.parse(fs.readFileSync(stateFile,'utf8'));if(['idle','running','complete','failed'].includes(saved.state))state={...state,...saved};if(state.state==='running')state={...state,state:'failed',error:'The previous update was interrupted. The last published data is still available.',finishedAt:new Date(now()).toISOString()}}catch{}
 const persist=()=>{fs.writeFileSync(stateFile+'.tmp',JSON.stringify(state,null,2));fs.renameSync(stateFile+'.tmp',stateFile)};
 const get=()=>{const index=readIndex(root);if(state.state==='failed'&&index.updatedAt&&Date.parse(index.updatedAt)>Date.parse(state.finishedAt||'')){state={...state,state:'complete',completed:state.total,lastSuccessfulAt:index.updatedAt,finishedAt:index.updatedAt};delete state.error;persist();}const precise=[state.lastSuccessfulAt,index.updatedAt].filter(s=>s&&Number.isFinite(Date.parse(s))).sort((a,b)=>Date.parse(b)-Date.parse(a));const last=precise[0]||(index.checkedAt?`${index.checkedAt}T00:00:00Z`:null);return {...state,lastSuccessfulAt:last,available:true,intervalHours:24,due:refreshDue({...state,lastSuccessfulAt:last},now()),sourcePatches:Object.fromEntries(Object.entries(index.providers||{}).map(([key,p])=>[key,p.sourcePatches||[]]))}};
 const progress=(completed,total)=>{if(state.state==='running'&&Number.isInteger(completed)&&Number.isInteger(total)&&total===state.total&&completed>=0&&completed<=total){state={...state,completed};persist()}};
 const execute=run||(async({jobId,checkedAt,onProgress})=>{
  const stage=path.join(directory,'runs',jobId);const line=l=>{const m=l.match(/^(\d+)\/(\d+)\s/);if(m)onProgress(Number(m[1]),Number(m[2]))};
  const track=c=>{child=c;if(cancelled)c.kill()};
  await runProcess(process.env.RIFT_PYTHON||'python',['scripts/collect-provider-research.py','--refresh','--checked-at',checkedAt,'--output-dir',stage],root,line,track);
  if(cancelled)throw new Error('Update cancelled; previous data retained.');
  await runProcess(process.execPath,['scripts/prepare-provider-research.mjs','--input-dir',stage],root,line,track);
  return readIndex(root);
 });
 const start=({automatic=false}={})=>{
  if(active||automatic&&!get().due)return get();const lastSuccessfulAt=get().lastSuccessfulAt;
  const jobId=randomUUID(),startedAt=new Date(now()).toISOString(),checkedAt=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now()));cancelled=false;
  state={state:'running',jobId,completed:0,total:readIndex(root).championCount||173,startedAt,lastSuccessfulAt};persist();
  active=(async()=>{try{const result=await execute({jobId,checkedAt,onProgress:progress});state={...state,state:'complete',completed:state.total,lastSuccessfulAt:result.updatedAt||new Date(now()).toISOString(),finishedAt:new Date(now()).toISOString()};delete state.error}catch(e){state={...state,state:'failed',error:String(e.message||e).slice(-600),finishedAt:new Date(now()).toISOString()}}finally{child=null;persist();active=null}})();return get();
 };
 return {get,start,wait:()=>active||Promise.resolve(),cancel:()=>{cancelled=true;child?.kill()}};
}
const serviceKey=Symbol.for('rift.providerRefresh.services');const services=globalThis[serviceKey]||(globalThis[serviceKey]=new Map());
export function providerRefreshMiddleware(root,{service:provided}={}){let service=provided||services.get(root);if(!service){service=createRefreshService(root);services.set(root,service)}return async(req,res,next)=>{
 if(req.url?.split('?')[0]!=='/api/provider-refresh')return next();const send=(code,obj)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(obj))};
 let host;try{host=new URL(`http://${req.headers.host}`).hostname}catch{return send(403,{error:'Use the local app to update sources.'})}if(!['localhost','127.0.0.1','[::1]'].includes(host))return send(403,{error:'Updates are available only on the local app.'});
 if(req.method==='GET')return send(200,service.get());if(req.method!=='POST')return send(405,{error:'Use POST to update sources.'});if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return send(403,{error:'Update requests must come from this local app.'});
 if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'Expected JSON.'});
 try{let body='';for await(const part of req){body+=part;if(body.length>1024)return send(413,{error:'Request is too large.'})}const input=JSON.parse(body);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>k!=='automatic')||input.automatic!==undefined&&typeof input.automatic!=='boolean')return send(400,{error:'Invalid update request.'});return send(202,service.start(input))}catch{return send(400,{error:'Invalid update request.'})}
};}
