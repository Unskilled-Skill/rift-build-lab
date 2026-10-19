import type {Champion,Item,Scenario} from './types';
import {effectTags} from './combat-effect-tags';

export interface DamageEffectPacket {type:'magic'|'physical'|'true';time:number;kind:'ability'|'attack'|'on-hit'|'proc';ultimate:'single'|'area'|false|'unknown';periodic?:boolean}
interface EffectSetup {ptaActive?:boolean;shojinStacks?:number;cleaverStacks?:number;abyssalInRange?:boolean;targetBonusHP?:number;axiomMode?:'auto'|'off'|'single'|'area'}
const finite=(value:number|undefined)=>Number.isFinite(value)?value!:0;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,finite(value)));
/** Snapshot source: catalog 26.20. Prepared state is explicit, never granted by its own hit. */
export function createDamageEffects(champion:Champion,items:Item[],s:Scenario){
 const effects:EffectSetup=(s as Scenario&{effects?:EffectSetup}).effects??{};
 const has=(id:number)=>items.some(item=>item.id===id),rune=(id:number)=>s.runePage.includes(id);
 const notes:string[]=[],implemented:string[]=[];
 const shojinPerStack=(champion.stats?.attackrange??0)>300?.015:.03;
 const enabled=(condition:boolean,label:string,note?:string)=>{if(condition){implemented.push(label);if(note)notes.push(note);}};
 enabled(rune(8017),'Cut Down','Cut Down uses live target health strictly above 60%; true damage is excluded.');
 enabled(rune(8014),'Coup de Grace','Coup de Grace uses live target health strictly below 40%; true damage is excluded.');
 enabled(rune(8299),'Last Stand','Last Stand uses actual caster health below 60%, reaching 11% at 30%; true damage is excluded.');
 enabled(rune(8005),'Press the Attack prepared amplification','PTA 8% amplification requires explicit prior activation; the third-hit burst and automatic stack generation are not included.');
 enabled(rune(8224),'Axiom Arcanist','Axiom uses classified ultimate damage: 12% single-target, 8% area. Unknown classifications and true-damage ultimate interactions remain unamplified unless source eligibility is established.');
 enabled(has(3161),'Spear of Shojin prepared amplification','Shojin uses only supplied pre-existing stacks (0–4), 3% each melee or 1.5% ranged (source attack range; form changes require verification), on champion ability/passive packets; delivery attack damage and true damage are excluded. Automatic stack generation is not simulated.');
 enabled(has(4633),'Riftmaker combat ramp','Riftmaker gains 2% per completed combat second, up to 8%; true damage is excluded.');
 enabled(has(6653),'Liandry Suffering combat ramp','Liandry Suffering gains 2% per completed combat second, up to 6%; true damage is excluded. Torment burn is a separate effect.');
 enabled(has(8020),'Abyssal Mask in-range vulnerability','Abyssal Mask 12% magic vulnerability requires explicit target-in-aura confirmation.');
 enabled(has(4645),'Shadowflame Cinderbloom','Shadowflame grants 20% magic/true damage strictly below 40% live target HP. Current 26.20 engine values SpellItemDamageAmp and DamageOverTimeAmp both equal 20%.');
 enabled(has(3071),'Black Cleaver prepared armor reduction','Black Cleaver uses supplied pre-existing Carve stacks: 6% each, maximum 5 (30%), before penetration. New same-hit stacks and expiration are not simulated.');
 enabled(has(3036),'Lord Dominik Giant Slayer','Giant Slayer uses explicitly supplied target bonus HP, not total HP: up to 15% at 1500 bonus HP. True damage is excluded.');
 if(has(3161)&&['Yasuo','Yone','Zeri'].includes(champion.alias))notes.push('Mixed attack/ability delivery classification requires a client check for Shojin: spell-only source adapters do not imply that every attack-specific effect activates; verify the scored packet against its in-game damage classification.');
 if(rune(8224)&&effectTags(champion.alias,s.mode,'').ultimate==='unknown'&&(effects.axiomMode??'auto')==='auto')notes.push(`${champion.name}: this ultimate packet has an unresolved single-target/area classification; Axiom is disabled until an explicit classification is supplied.`);
 return {
  multiplier(packet:DamageEffectPacket,targetHealthPercent:number,ownerHealthPercent:number){
   // Proc producers own their accounting. They must not feed back into native effects.
   // Proc generation is separate. General owned-damage modifiers apply once,
   // while native-only modifiers below exclude item/rune packets.
   let multiplier=1;
   const target=clamp(targetHealthPercent,0,100),owner=clamp(ownerHealthPercent,0,100);
   if(packet.type!=='true'){
    if(has(3036))multiplier*=1+.15*clamp(effects.targetBonusHP??0,0,1500)/1500;
    if(rune(8017)&&target>60)multiplier*=1.08;
    if(rune(8014)&&target<40)multiplier*=1.08;
    if(rune(8299)&&owner<60)multiplier*=1+.05+.06*clamp((60-owner)/30,0,1);
    if(rune(8005)&&effects.ptaActive)multiplier*=1.08;
    const seconds=Math.floor(Math.max(0,finite(s.combatSeconds)+Math.max(0,finite(packet.time)))+1e-9);
    if(has(4633))multiplier*=1+.02*Math.min(4,seconds);
    if(has(6653))multiplier*=1+.02*Math.min(3,seconds);
    if(has(3161)&&packet.kind!=='attack'&&packet.kind!=='proc')multiplier*=1+shojinPerStack*Math.floor(clamp(effects.shojinStacks??0,0,4));
    const mode=effects.axiomMode??'auto';
    const ultimate=packet.ultimate===false?false:mode==='auto'?packet.ultimate:mode;
    if(rune(8224)&&ultimate==='single')multiplier*=1.12;
    if(rune(8224)&&ultimate==='area')multiplier*=1.08;
   }
   if(has(8020)&&effects.abyssalInRange&&packet.type==='magic')multiplier*=1.12;
   if(has(4645)&&target<40&&(packet.type==='magic'||packet.type==='true'))multiplier*=1.2;
   return multiplier;
  },
  targetArmor(armor:number){return has(3071)&&armor>0?armor*(1-.06*Math.floor(clamp(effects.cleaverStacks??0,0,5))):armor;},
  notes,implemented
 };
}
