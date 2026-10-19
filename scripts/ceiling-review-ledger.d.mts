export interface CeilingReviewRow {
 champion:string;
 key:string;
 entryHash:string;
 evidenceHash:string;
 sourcePaths:string[];
 scalingSummary:string;
 runeAssessment:string;
 shardAssessment:string;
 preparationAssessment:string;
 decision:'corrected'|'retained';
 changes:string[];
 manualChecks:string[];
}
export interface CeilingReviewSummary {
 patch:string;
 reviewedAt:string;
 targetCount:number;
 championCount:number;
 correctedCount:number;
 retainedCount:number;
 targets:CeilingReviewRow[];
}
export function hashCeilingReviewValue(value:unknown):string;
export function validateCeilingReviewLedger(entries:unknown,catalog:unknown,resources:Record<string,string>,context:unknown,reports:unknown,kits:Record<string,unknown>):CeilingReviewSummary;
