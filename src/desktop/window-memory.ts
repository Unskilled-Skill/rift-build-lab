/** Release WebView2 caches while idle; keep normal performance during interaction.
 * This module is mounted only by DesktopShell, never by the standalone website.
 */
export interface WindowMemoryOptions {
 events:Pick<EventTarget,'addEventListener'|'removeEventListener'>;
 focused:()=>boolean;
 busy?:()=>boolean;
 send:(active:boolean)=>Promise<unknown>;
 idleMs?:number;
}
export function connectWindowMemory({events,focused,busy=()=>false,send,idleMs=15_000}:WindowMemoryOptions):()=>void{
 let timer:ReturnType<typeof setTimeout>|undefined,mode:boolean|undefined,stopped=false,lastMove=-Infinity,request=0;
 const clear=()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined}};
 const set=(active:boolean)=>{if(stopped||mode===active)return;mode=active;const sent=++request;void send(active).catch(()=>{if(!stopped&&sent===request)mode=undefined;/* Retry on the next activity or idle transition, without a polling loop. */})};
 const sleep=()=>{if(stopped)return;clear();if(busy()){set(true);timer=setTimeout(sleep,idleMs)}else set(false)};
 const wake=(event?:Event)=>{
  if(stopped||!focused())return;
  const now=Date.now();if(event?.type==='pointermove'&&now-lastMove<1000)return;
  lastMove=now;set(true);clear();timer=setTimeout(sleep,idleMs);
 };
 const inputs=['pointerdown','pointermove','keydown','wheel','touchstart','click','input','compositionstart','focus'];
 for(const name of inputs)events.addEventListener(name,wake,{passive:true});
 events.addEventListener('blur',sleep);
 if(focused())wake();else sleep();
 return ()=>{stopped=true;clear();for(const name of inputs)events.removeEventListener(name,wake);events.removeEventListener('blur',sleep)};
}
