type Slot={slot:number;matches:number};
export function itemTiming(sources:unknown[],itemIds:Set<number>):{global:Record<number,Slot>;champions:Record<string,Record<number,Slot>>;sources:number;games:number};
