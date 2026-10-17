import type {CompanionBundle} from '../league-export';
import type {PlanRole} from '../build-plan';
// Shared platform contract (plan §2.2). The website implements it without native access; desktop IPC implements it in T17.
export const errorCodes=['client-unavailable','tls','not-signed-in','unsafe-phase','patch-mismatch','rejected','rune-capacity','ambiguous-ownership','partial-apply','readback-mismatch','backup-failed','invalid-bundle','no-build-for-role','data-incompatible','internal'] as const;
export type ErrorCode=typeof errorCodes[number];
export class PlatformError extends Error {
 constructor(public code:ErrorCode,message:string){super(message);this.name='PlatformError'}
}
export interface Capabilities {nativeApply:boolean;autoImport:boolean;tray:boolean;dataUpdates:boolean}
export type AssignedRole=Exclude<PlanRole,'unspecified'>;
export type ConnectionState=
 |{kind:'disabled'}|{kind:'league-closed'}|{kind:'connecting'}
 |{kind:'connected';phase:string}|{kind:'champ-select';champion?:string;role?:AssignedRole}
 |{kind:'applying'}|{kind:'applied';build:string;verified:boolean}
 |{kind:'paused'}|{kind:'needs-attention';code:ErrorCode;message:string;recovery:string};
export interface ApplyResult {outcome:'verified'|'applied-unverified'|'rolled-back'|'partial'|'rejected';message:string;backupPath?:string}
export interface DefaultBuild {planId:string;patch:string;bundleSha256:string;bundle:CompanionBundle}
export interface Preferences {
 schema:1;
 autoImport:{enabled:boolean;items:boolean;runes:boolean;metaFallback:boolean};
 background:{trayOnClose:boolean;startWithWindows:boolean};
 defaults:Record<string,DefaultBuild>; // key `${champion}|${role}`
 lastApplied:{at:string;champion:string;role:PlanRole;planId:string;outcome:ApplyResult['outcome']}|null;
 lastFailure:{at:string;code:ErrorCode;message:string}|null;
}
export type PreferencesPatch={autoImport?:Partial<Preferences['autoImport']>;background?:Partial<Preferences['background']>};
export interface DataUpdateResult {status:'up-to-date'|'updated'|'offline'|'failed'|'app-update-required';revision:string;patch:string;checkedAt:string;message:string}
export type ExternalLink='releases'|'riot-lcu-policy'|'website'|{kind:'source';url:string};
export interface NativeBuildActions {
 apply(bundle:CompanionBundle,options:{items:boolean;runes:boolean}):Promise<ApplyResult>;
 setDefault(key:{champion:string;role:AssignedRole},bundle:CompanionBundle,planId:string):Promise<void>;
}
export interface Platform extends NativeBuildActions {
 kind:'web'|'desktop';capabilities:Capabilities;
 status():Promise<ConnectionState>;onStatus(callback:(state:ConnectionState)=>void):()=>void;
 testConnection():Promise<{reachable:boolean;clientVersion?:string;message:string}>;
 preferences():Promise<Preferences>;updatePreferences(patch:PreferencesPatch):Promise<Preferences>;
 pause():Promise<void>;resume():Promise<void>;reapply():Promise<ApplyResult>;
 openBackupFolder():Promise<void>;checkDataUpdates():Promise<DataUpdateResult>;
 openExternal(link:ExternalLink):Promise<void>;
}
