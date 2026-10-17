import type {ConnectionState} from '../platform/types';
// Plain-language connection status for the desktop strip. A requested or unconfirmed import is
// never described as imported; only a read-back-verified result is.
export type StatusAction='pause'|'resume'|'reapply';
export interface StatusView {tone:'muted'|'active'|'ok'|'warning';title:string;detail?:string;actions:StatusAction[]}
const roles:Record<string,string>={top:'Top',jungle:'Jungle',mid:'Mid',adc:'Bot',support:'Support'};
const phases:Record<string,string>={None:'home',Lobby:'lobby',Matchmaking:'in queue',ReadyCheck:'ready check',ChampSelect:'champion select',GameStart:'game starting',InProgress:'in game',Reconnect:'reconnecting',WaitingForStats:'post-game',PreEndOfGame:'post-game',EndOfGame:'post-game'};
/** `meta:Ahri:mid:opgg` → `Ahri mid meta plan`; `authored:Ahri:x` → `Ahri saved build`. */
export function planLabel(planId:string):string{
 const [kind,champion,role]=planId.split(':');
 if(!champion)return 'selected build';
 return kind==='meta'&&role?`${champion} ${role} meta plan`:`${champion} saved build`;
}
export function describeStatus(state:ConnectionState):StatusView{
 switch(state.kind){
  case 'disabled':return {tone:'muted',title:'Automatic imports off',detail:'You can still apply any build from its page.',actions:[]};
  case 'connecting':return {tone:'muted',title:'Looking for League',actions:['pause']};
  case 'league-closed':return {tone:'muted',title:'League closed',detail:'Imports start when you enter champion select.',actions:['pause']};
  case 'connected':return {tone:'active',title:`Connected · ${phases[state.phase]||state.phase.toLowerCase()}`,actions:['pause']};
  case 'champ-select':return {tone:'active',title:['Champion select',state.champion,state.role&&roles[state.role]].filter(Boolean).join(' · '),actions:['pause']};
  case 'applying':return {tone:'active',title:'Importing items and runes…',actions:[]};
  case 'applied':return state.verified
   ?{tone:'ok',title:`Imported ${planLabel(state.build)}`,actions:['reapply','pause']}
   :{tone:'warning',title:`${planLabel(state.build)} sent to League — not confirmed by read-back`,detail:'Check your items and runes in League before playing.',actions:['reapply','pause']};
  case 'paused':return {tone:'muted',title:'Automatic imports paused',actions:['resume']};
  case 'needs-attention':return {tone:'warning',title:state.message,detail:state.recovery,actions:['reapply','pause']};
 }
}
