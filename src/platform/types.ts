import type {CompanionBundle} from '../league-export';
import type {PlanRole} from '../build-plan';
// Shared platform contract (plan §2.2). The website implements it without native access; desktop IPC implements it in T17.
export const errorCodes=['client-unavailable','tls','not-signed-in','unsafe-phase','patch-mismatch','rejected','rune-capacity','ambiguous-ownership','partial-apply','readback-mismatch','backup-failed','invalid-bundle','selection-changed','no-build-for-role','data-incompatible','internal'] as const;
export type ErrorCode=typeof errorCodes[number];
export class PlatformError extends Error {
 constructor(public code:ErrorCode,message:string,public recovery?:string){super(message);this.name='PlatformError'}
}
export interface Capabilities {nativeApply:boolean;autoImport:boolean;tray:boolean;dataUpdates:boolean}
export type AssignedRole=Exclude<PlanRole,'unspecified'>;
export type ConnectionState=
 |{kind:'disabled'}|{kind:'league-closed'}|{kind:'connecting'}
 |{kind:'connected';phase:string}|{kind:'champ-select';champion?:string;role?:AssignedRole}
 |{kind:'applying'}|{kind:'applied';build:string;verified:boolean}
 |{kind:'paused'}|{kind:'needs-attention';code:ErrorCode;message:string;recovery:string};
export const applyOutcomes=['verified','applied-unverified','rolled-back','partial','rejected'] as const;
export interface ApplyResult {outcome:typeof applyOutcomes[number];message:string;backupPath?:string}
export interface DefaultBuild {planId:string;patch:string;bundleSha256:string;bundle:unknown}
export interface Preferences {
 schema:1;
 autoImport:{enabled:boolean;items:boolean;runes:boolean;metaFallback:boolean};
 background:{trayOnClose:boolean;startWithWindows:boolean};
 defaults:Record<string,DefaultBuild>; // key `${champion}|${role}`
 needsReview?:Record<string,DefaultBuild>; // defaults that no longer validate against the installed data
 lastApplied:{at:string;champion:string;role:AssignedRole;planId:string;outcome:ApplyResult['outcome']}|null;
 lastFailure:{at:string;code:ErrorCode;message:string}|null;
 ui?:Record<string,unknown>;
}
export type PreferencesPatch={autoImport?:Partial<Preferences['autoImport']>;background?:Partial<Preferences['background']>};
export const updateStatuses=['up-to-date','updated','offline','failed','app-update-required'] as const;
export interface DataUpdateResult {status:typeof updateStatuses[number];revision:string;patch:string;checkedAt:string;message:string}
export interface RevisionInfo {revision:string;patch:string;dataVersion:string;generatedAt:string;sourceCheckedAt:{providers:string;roles:string};bundled:boolean}
export interface TestConnection {reachable:boolean;clientVersion?:string;message:string}
export interface AppUpdate {current:string;latest?:string;releaseUrl?:string;ready:boolean}
export interface OpenBuild {champion:string;planId?:string}
export type ExternalLink='releases'|'riot-lcu-policy'|'website'|{kind:'source';url:string};
export interface NativeBuildActions {
 apply(bundle:CompanionBundle,options:{items:boolean;runes:boolean}):Promise<ApplyResult>;
 setDefault(key:{champion:string;role:AssignedRole},bundle:CompanionBundle,planId:string):Promise<void>;
}
export interface Platform extends NativeBuildActions {
 kind:'web'|'desktop';capabilities:Capabilities;
 status():Promise<ConnectionState>;onStatus(callback:(state:ConnectionState)=>void):()=>void;
 testConnection():Promise<TestConnection>;
 preferences():Promise<Preferences>;updatePreferences(patch:PreferencesPatch):Promise<Preferences>;
 clearDefault(key:{champion:string;role:AssignedRole}):Promise<void>;
 pause():Promise<void>;resume():Promise<void>;reapply():Promise<void>;
 openBackupFolder():Promise<void>;checkDataUpdates():Promise<DataUpdateResult>;revision():Promise<RevisionInfo>;
 onDataRevision(callback:(revision:RevisionInfo)=>void):()=>void;
 checkAppUpdate():Promise<AppUpdate>;
 /** Installs a downloaded, signature-verified update (the app closes and restarts). False if none is ready. */
 installAppUpdate():Promise<boolean>;onAppUpdateReady(callback:(version:string)=>void):()=>void;
 openExternal(link:ExternalLink):Promise<void>;
 /** Window lifecycle: saved before the window closes to the tray, read back when it reopens. */
 saveUiState(state:Record<string,unknown>):Promise<void>;onPersistUiState(callback:()=>void):()=>void;
 takePendingOpen():Promise<OpenBuild|null>;onOpenBuild(callback:(build:OpenBuild)=>void):()=>void;
}
