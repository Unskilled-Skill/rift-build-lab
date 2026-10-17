import type {BuildPlan} from '../build-plan';
import type {Platform} from './types';
// Desktop window state and website ↔ desktop build links. Plan ids look like
// `<collection>:<Champion>:<build id>` (meta plans: `meta:<Champion>:<role>:<provider>`).
export const appTabs=['Builds','Meta & teams','Test bench','Champion kit','Items','Runes','Data & coverage'] as const;
export type AppTab=typeof appTabs[number];
export type BuildRoute={tab:'Builds';collection?:'four'|'ceilings'|'meta'|'earlier';buildId?:string}|{tab:'Meta & teams'};
const libraryCollections={authored:'four',ceiling:'ceilings','meta-reference':'meta',experiment:'earlier'} as const;
const buildId=/^[a-z0-9-]{1,80}$/;
export function routeForPlan(planId:string|undefined):BuildRoute{
 const [kind,,id]=(planId||'').split(':');
 if(kind==='meta')return {tab:'Meta & teams'};
 const collection=libraryCollections[kind as keyof typeof libraryCollections];
 return collection&&id&&buildId.test(id)?{tab:'Builds',collection,buildId:id}:{tab:'Builds'};
}
/** Only a known tab and an existing champion are restored. */
export function restoreUi(ui:Record<string,unknown>|undefined,champions:{alias:string}[]):{tab?:AppTab;champion?:string}{
 const out:{tab?:AppTab;champion?:string}={};
 if(typeof ui?.tab==='string'&&(appTabs as readonly string[]).includes(ui.tab))out.tab=ui.tab as AppTab;
 if(typeof ui?.champion==='string'&&champions.some(c=>c.alias===ui.champion))out.champion=ui.champion;
 return out;
}
/** Window state has one owner on disk; merge so the first-run flag and view state don't overwrite each other. */
export async function mergeUi(platform:Platform,patch:Record<string,unknown>):Promise<void>{
 const current=(await platform.preferences()).ui||{};
 await platform.saveUiState({...current,...patch});
}
const linkPlanId=/^[A-Za-z0-9:_-]{1,300}$/;
/** `riftbuildlab-desktop://open?…` for a saved build; unsaved test-bench setups have no stable id. */
export function desktopLink(plan:BuildPlan):string|null{
 if(plan.collection==='workspace'||!linkPlanId.test(plan.id)||!/^[A-Za-z0-9]{1,40}$/.test(plan.champion))return null;
 return `riftbuildlab-desktop://open?champion=${plan.champion}&plan=${plan.id}`;
}
