import type {AppUpdate,ApplyResult,ConnectionState,DataUpdateResult,ErrorCode,OpenBuild,Preferences,RevisionInfo,TestConnection} from './types';
import {applyOutcomes,errorCodes,updateStatuses} from './types';
// Runtime checks for everything the desktop app sends to the window. Shapes follow
// tests/fixtures/ipc-samples.json, which the Rust core regenerates from its real serializers.
type Obj=Record<string,unknown>;
const obj=(v:unknown):v is Obj=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const str=(v:unknown):v is string=>typeof v==='string';
const bool=(v:unknown):v is boolean=>typeof v==='boolean';
const optStr=(v:unknown)=>v===undefined||str(v);
const oneOf=<T extends string>(list:readonly T[],v:unknown):v is T=>str(v)&&(list as readonly string[]).includes(v);
const roles=['top','jungle','mid','adc','support'] as const;
const alias=/^[A-Za-z0-9]{1,40}$/,planId=/^[A-Za-z0-9:_-]{1,300}$/;
export const isErrorCode=(v:unknown):v is ErrorCode=>oneOf(errorCodes,v);
export function isConnectionState(v:unknown):v is ConnectionState{
 if(!obj(v))return false;
 switch(v.kind){
  case 'disabled':case 'league-closed':case 'connecting':case 'applying':case 'paused':return true;
  case 'connected':return str(v.phase);
  case 'champ-select':return optStr(v.champion)&&(v.role===undefined||oneOf(roles,v.role));
  case 'applied':return str(v.build)&&bool(v.verified);
  case 'needs-attention':return isErrorCode(v.code)&&str(v.message)&&str(v.recovery);
  default:return false;
 }
}
export const isApplyResult=(v:unknown):v is ApplyResult=>obj(v)&&oneOf(applyOutcomes,v.outcome)&&str(v.message)&&optStr(v.backupPath);
const isDefault=(v:unknown)=>obj(v)&&str(v.planId)&&str(v.patch)&&str(v.bundleSha256)&&'bundle' in v;
const isDefaults=(v:unknown)=>obj(v)&&Object.entries(v).every(([k,d])=>/^[A-Za-z0-9]+\|(top|jungle|mid|adc|support)$/.test(k)&&isDefault(d));
export function isPreferences(v:unknown):v is Preferences{
 if(!obj(v)||v.schema!==1||!obj(v.autoImport)||!obj(v.background))return false;
 const a=v.autoImport,b=v.background,applied=v.lastApplied,failure=v.lastFailure;
 return bool(a.enabled)&&bool(a.items)&&bool(a.runes)&&bool(a.metaFallback)&&bool(b.trayOnClose)&&bool(b.startWithWindows)
  &&isDefaults(v.defaults)&&(v.needsReview===undefined||isDefaults(v.needsReview))
  &&(applied===null||(obj(applied)&&str(applied.at)&&str(applied.champion)&&oneOf(roles,applied.role)&&str(applied.planId)&&oneOf(applyOutcomes,applied.outcome)))
  &&(failure===null||(obj(failure)&&str(failure.at)&&isErrorCode(failure.code)&&str(failure.message)))
  &&(v.ui===undefined||obj(v.ui));
}
export const isDataUpdateResult=(v:unknown):v is DataUpdateResult=>obj(v)&&oneOf(updateStatuses,v.status)&&str(v.revision)&&str(v.patch)&&str(v.checkedAt)&&str(v.message);
export const isRevisionInfo=(v:unknown):v is RevisionInfo=>obj(v)&&str(v.revision)&&str(v.patch)&&str(v.dataVersion)&&str(v.generatedAt)&&obj(v.sourceCheckedAt)&&str(v.sourceCheckedAt.providers)&&str(v.sourceCheckedAt.roles)&&bool(v.bundled);
export const isTestConnection=(v:unknown):v is TestConnection=>obj(v)&&bool(v.reachable)&&optStr(v.clientVersion)&&str(v.message);
export const isAppUpdate=(v:unknown):v is AppUpdate=>obj(v)&&str(v.current)&&optStr(v.latest)&&(v.releaseUrl===undefined||(str(v.releaseUrl)&&v.releaseUrl.startsWith('https://github.com/Unskilled-Skill/rift-build-lab/releases')));
export const isOpenBuild=(v:unknown):v is OpenBuild=>obj(v)&&str(v.champion)&&alias.test(v.champion)&&(v.planId===undefined||(str(v.planId)&&planId.test(v.planId)));
export const isIpcError=(v:unknown):v is {code:ErrorCode;message:string;recovery:string}=>obj(v)&&isErrorCode(v.code)&&str(v.message)&&str(v.recovery);
