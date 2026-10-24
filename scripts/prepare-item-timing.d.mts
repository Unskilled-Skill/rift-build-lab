type Slot={slot:number;matches:number};
export function itemTiming(sources:unknown[],itemIds:Set<number>):{global:Record<number,Slot>;champions:Record<string,Record<number,Slot>>;roles:Record<string,{role:string;matches:number}[]>;keystones:Record<string,{id:number;matches:number}[]>;pages:Record<string,{runePage:number[];shards:number[]}>;sources:number;games:number};
