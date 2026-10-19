export interface CeilingRunePlan {
 target:string;
 reviewedAt:string;
 verification:'reasoned-candidate';
 objective:string;
 runes:number[];
 shards:number[];
 reason:string;
 runeReasons:string[];
 shardReason:string;
 setup:string[];
 alternatives:string[];
 exclusions:string[];
}
export function validateCeilingRunePlan(entry:unknown,catalog:unknown,resources:Record<string,string>):CeilingRunePlan;
export function runeReviewSteps(plan:CeilingRunePlan):string[];
