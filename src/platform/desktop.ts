import {invoke} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import type {ExternalLink,OpenBuild,Platform} from './types';
import {PlatformError} from './types';
import * as guard from './guards';
// Desktop build only: typed wrappers over the app's own IPC commands. Every response and event is
// checked at runtime; anything unexpected becomes a PlatformError rather than reaching the UI.
const unexpected=()=>new PlatformError('internal','Unexpected response from the desktop app.');
async function call<T>(command:string,args:Record<string,unknown>|undefined,check:(v:unknown)=>v is T):Promise<T>{
 let value:unknown;
 try{value=args?await invoke(command,args):await invoke(command)}
 catch(error){throw guard.isIpcError(error)?new PlatformError(error.code,error.message,error.recovery):new PlatformError('internal','The desktop app could not complete this request.')}
 if(!check(value))throw unexpected();
 return value;
}
const isNull=(v:unknown):v is null=>v===null||v===undefined;
const isPendingOpen=(v:unknown):v is OpenBuild|null=>v===null||guard.isOpenBuild(v);
/** Subscribes to a native event, delivering only payloads that pass `check`. */
function subscribe<T>(event:string,check:(v:unknown)=>v is T,callback:(value:T)=>void):()=>void{
 let stop:(()=>void)|undefined,cancelled=false;
 void listen(event,e=>{if(check(e.payload))callback(e.payload)}).then(unlisten=>{if(cancelled)unlisten();else stop=unlisten}).catch(()=>{/* A lost event channel must not create an unhandled rejection. Explicit commands still report connectivity. */});
 return()=>{cancelled=true;stop?.()};
}
const linkArg=(link:ExternalLink)=>typeof link==='string'?{kind:link}:link;
export const desktopPlatform:Platform={
 kind:'desktop',
 capabilities:{nativeApply:true,autoImport:true,tray:true,dataUpdates:true},
 status:()=>call('get_status',undefined,guard.isConnectionState),
 onStatus:callback=>subscribe('status-changed',guard.isConnectionState,callback),
 testConnection:()=>call('test_connection',undefined,guard.isTestConnection),
 apply:(bundle,{items,runes})=>call('apply_build',{request:{bundle,items,runes}},guard.isApplyResult),
 setDefault:async({champion,role},bundle,planId)=>{await call('set_default_build',{request:{champion,role,planId,bundle}},isNull)},
 clearDefault:async({champion,role})=>{await call('clear_default_build',{key:{champion,role}},isNull)},
 preferences:()=>call('get_preferences',undefined,guard.isPreferences),
 updatePreferences:patch=>call('update_preferences',{patch},guard.isPreferences),
 pause:async()=>{await call('pause_auto_import',undefined,isNull)},
 resume:async()=>{await call('resume_auto_import',undefined,isNull)},
 reapply:async()=>{await call('reapply_last',undefined,isNull)},
 openBackupFolder:async()=>{await call('open_backup_folder',undefined,isNull)},
 checkDataUpdates:()=>call('check_data_updates',undefined,guard.isDataUpdateResult),
 revision:()=>call('get_data_revision',undefined,guard.isRevisionInfo),
 onDataRevision:callback=>subscribe('data-revision-changed',guard.isRevisionInfo,callback),
 checkAppUpdate:()=>call('check_app_update',undefined,guard.isAppUpdate),
 openExternal:async link=>{await call('open_external',{link:linkArg(link)},isNull)},
 saveUiState:async state=>{await call('ui_state_saved',{state},isNull)},
 onPersistUiState:callback=>subscribe('persist-ui-state',(_v:unknown):_v is unknown=>true,()=>callback()),
 takePendingOpen:()=>call('take_pending_open',undefined,isPendingOpen).then(v=>v??null),
 onOpenBuild:callback=>subscribe('open-build',guard.isOpenBuild,callback),
};
