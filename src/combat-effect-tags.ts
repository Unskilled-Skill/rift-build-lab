import type {Scenario} from './types';

export type NativeDamageTags={kind:'ability'|'attack'|'on-hit';ultimate:'single'|'area'|false|'unknown';aoe?:boolean;spellEffects:boolean;appliesOnHit:boolean;onHitMultiplier:number};
// Classify the actual scored packet, never the rune page or just the R slot.
// Ambiguous pet, transform and target-selection classifications stay explicit.
const areaUltimates=new Set(['Aphelios','Zac','Ornn','Rammus','Annie','Ambessa','Zaahen','Hecarim','Senna','Skarner','Rumble','AurelionSol','Azir','Shyvana','Smolder','MonkeyKing','Yuumi','Zeri','Gangplank','Illaoi','Irelia','Qiyana','Xayah','Yasuo','Yone','Kayle','KogMaw','Aurora','Hwei','Sona','Teemo','Viktor','Jax','Jinx','Ekko','Evelynn','Kassadin','Rakan','Zyra','Sejuani','Maokai','Sion','Poppy','Leona','Braum','Nunu','Volibear','XinZhao','Fizz','LeeSin','Akali','Draven','Graves','JarvanIV','Talon','Pantheon','Orianna','Lissandra','Xerath','Seraphine','Nami','Corki','Lux','Malphite','Ezreal','Gragas','Morgana','Ziggs','Amumu']);
const singleUltimates=new Set(['Darius','Kayn','Urgot','Kled','Varus','Thresh','Tristana','Vi','Ashe','Nocturne','Syndra','Brand','Chogath']);
const basicR=new Set(['Udyr','Elise','Jayce','Nidalee']);
// Delivery attacks are distinct from their champion-owned bonus/on-hit packets.
const attackModes:Record<string,string[]>={Blitzcrank:['blitz-e'],Urgot:['cast-w'],Trundle:['cast-q'],Nasus:['cast-q'],Garen:['cast-q'],Yorick:['cast-q'],XinZhao:['cast-q'],Volibear:['cast-q'],Camille:['cast-q'],Renekton:['cast-w','cast-w-empowered']};
const onHitAbilities:Record<string,string[]>={Ezreal:['cast-q'],Gangplank:['cast-q'],Irelia:['cast-q']};
const basicArea:Record<string,string[]>={Lux:['cast-e'],Gragas:['cast-q','cast-q-max','cast-e'],Ahri:['cast-q'],Cassiopeia:['q','qe','sequence'],Sett:['w'],Zac:['cast-w','cast-e'],Sion:['cast-q','cast-q-max'],Karthus:['cast-q'],Garen:['cast-e'],Rumble:['cast-q'],Morgana:['cast-w'],Diana:['cast-q','cast-w'],Anivia:['cast-q'],Sivir:['cast-q'],Nilah:['cast-q'],Yasuo:['cast-q'],Yone:['cast-q'],Malphite:['cast-e'],Taric:['cast-e']};
const basicSingle:Record<string,string[]>={Cassiopeia:['e'],Blitzcrank:['blitz-e'],TahmKench:['tahm-q'],Ezreal:['cast-q','cast-w'],Gangplank:['cast-q'],Trundle:['cast-q'],Warwick:['cast-q'],Fiora:['cast-q'],Vayne:['cast-e'],Olaf:['cast-e'],Ryze:['cast-w'],Annie:['cast-q'],Veigar:['cast-r']};
export function effectTags(alias:string,mode:Scenario['mode'],packetName:string):NativeDamageTags {
 const name=packetName.toLowerCase();
 let kind:NativeDamageTags['kind']='ability';
 if(/delivery attack|normal attack|basic attack|attack physical|attack base|power fist/.test(name)||attackModes[alias]?.includes(mode))kind='attack';
 else if(onHitAbilities[alias]?.includes(mode)||/on-hit|on hit|passive bonus|an acquired taste|silver bolts/.test(name))kind='on-hit';
 let ultimate:NativeDamageTags['ultimate']=false;
 if((mode.startsWith('cast-r')||mode==='tahm-r')&&!basicR.has(alias)){
  if(alias==='TahmKench')ultimate='single';
  else if(singleUltimates.has(alias))ultimate='single';
  else if(areaUltimates.has(alias))ultimate='area';
  else ultimate='unknown';
 }
 const mixedCassiopeia=alias==='Cassiopeia'&&/twin fang/.test(name)?false:undefined;
 const aoe=mixedCassiopeia??(ultimate==='area'?true:ultimate==='single'?false:basicArea[alias]?.includes(mode)?true:basicSingle[alias]?.includes(mode)?false:undefined);
 const delivery=kind==='attack'||Boolean(onHitAbilities[alias]?.includes(mode)&&!/bonus|passive|proc|detonation/.test(name));
 // UrgotW OnHitDamageReduction = 0.5 in the pinned champion engine record.
 return {kind,ultimate,spellEffects:kind==='ability'||(kind==='on-hit'&&delivery),appliesOnHit:delivery,onHitMultiplier:alias==='Urgot'&&mode==='cast-w'?.5:1,...(aoe===undefined?{}:{aoe})};
}
