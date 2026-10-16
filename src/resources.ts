import source from './ability-sources.json';
export type ResourceKind='mana'|'energy'|'none';
interface ResourceRule {kind:ResourceKind;baseMaximum:number;sourceType:string}
const rules=source.resources as Record<string,ResourceRule>;
export const championResource=(alias:string):ResourceRule=>rules[alias]||{kind:'mana',baseMaximum:0,sourceType:'Mana'};
