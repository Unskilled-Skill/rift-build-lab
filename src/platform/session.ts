import type {OpenBuild,Platform} from './types';
import {mergeUi} from './build-links';
export interface DesktopSessionCallbacks {
 restore:(ui:Record<string,unknown>|undefined)=>void;
 open:(build:OpenBuild)=>void;
 snapshot:()=>Record<string,unknown>;
 flush:()=>void;
 error:(error:unknown)=>void;
}
/** One lifecycle owner per window. Callbacks read the latest React state through a ref. */
export function connectDesktopSession(platform:Platform,callbacks:DesktopSessionCallbacks):()=>void{
 let stopped=false,started=false,queued:OpenBuild|undefined;
 const offOpen=platform.onOpenBuild(build=>{if(stopped)return;if(!started)queued=build;else callbacks.open(build)});
 let saving=Promise.resolve();
 const offPersist=platform.onPersistUiState(()=>{
  saving=saving.then(async()=>{if(stopped)return;callbacks.flush();await mergeUi(platform,callbacks.snapshot())}).catch(error=>{if(!stopped)callbacks.error(error)});
 });
 void (async()=>{
  try{
   const prefs=await platform.preferences();if(stopped)return;callbacks.restore(prefs.ui);
   const pending=await platform.takePendingOpen();if(stopped)return;started=true;
   if(queued||pending)callbacks.open(queued||pending!);
  }catch(error){if(!stopped){started=true;callbacks.error(error)}}
 })();
 return()=>{stopped=true;offOpen();offPersist()};
}
