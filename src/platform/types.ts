import type {CompanionBundle} from '../league-export';
import type {PlanRole} from '../build-plan';
// Shared platform contract (plan §2.2). T5 adds the full Platform interface; desktop IPC implements it in T17.
export interface Capabilities {nativeApply:boolean;autoImport:boolean;tray:boolean;dataUpdates:boolean}
export interface ApplyResult {outcome:'verified'|'applied-unverified'|'rolled-back'|'partial'|'rejected';message:string;backupPath?:string}
export interface NativeBuildActions {
 apply(bundle:CompanionBundle,options:{items:boolean;runes:boolean}):Promise<ApplyResult>;
 setDefault(key:{champion:string;role:Exclude<PlanRole,'unspecified'>},bundle:CompanionBundle,planId:string):Promise<void>;
}
