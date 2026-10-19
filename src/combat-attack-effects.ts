import type {Champion,Item,Result,Scenario} from './types';
import type {ProcHit,ProcPacket} from './combat-proc-effects';

/** Source-backed native-action triggers. Proc packets never enter this state machine. */
export function createAttackEffects(champion:Champion,items:Item[],s:Scenario,stats:Result['stats']){
 const e=s.effects??{},runes=new Set(s.runePage),ids=new Set(items.map(i=>i.id));
 const ranged=e.attackForm?e.attackForm==='ranged':(champion.stats.attackrange??125)>300;
 const ready=e.runeProcsReady===true,itemReady=e.itemProcsReady===true;
 const count=(n:number|undefined,max:number)=>Number.isFinite(n)?Math.floor(Math.max(0,Math.min(max,n!))):0;
 const level=Math.max(1,Math.min(18,s.level)),lerp=(a:number,b:number)=>a+(b-a)*(level-1)/17;
 const adaptive=(hit:ProcHit):ProcHit['type']=>stats.bonusAD>stats.ap*.6?'physical':stats.bonusAD<stats.ap*.6?'magic':hit.type==='physical'?'physical':'magic';
 let graspUsed=false,impactUsed=false,cheapAt=-Infinity,ptaAt=-Infinity,ptaLast=(e.ptaHitsBefore??0)>0?0:-Infinity;
 let ptaHits=count(e.ptaHitsBefore,2),electroAt=-Infinity;
 let electroHits:{id:string|number;time:number}[]=Array.from({length:count(e.electrocuteHitsBefore,2)},(_,n)=>({id:`prepared-${n}`,time:0}));
 const electroSeen=new Set<string|number>();
 const notes:string[]=[],implemented:string[]=[];
 const mark=(when:boolean,name:string,note:string)=>{if(when){implemented.push(name);notes.push(note)}};
 mark(runes.has(8005),'Press the Attack burst','PTA counts eligible native on-hit deliveries on one target, including entered 0–2 prior hits. Hits expire after a four-second gap; burst cooldown is six seconds. The 40–160 adaptive burst is not amplified by PTA itself. New 8% amplification begins after the burst resolves, refreshing on later native combat hits for five seconds. Same-frame proc ordering is a deterministic approximation.');
 mark(runes.has(8437),'Grasp ready damage','One explicitly charged Grasp deals 3.5% current owner max HP magic damage, 40% effective for ranged, on an eligible delivery. Earned Grasp HP is separate; same-hit HP growth, healing and recharge are excluded.');
 mark(runes.has(8112),'Electrocute','Electrocute counts three distinct native actions within three seconds, using entered prior-action preparation if supplied. DOT ticks and multiple packets of one action count once; proc damage never adds stacks. Damage is 70–240 + 10% bonus AD + 5% AP, with 20s cooldown. Prior prepared actions are anchored at trial time zero.');
 mark(runes.has(8126),'Cheap Shot','Cheap Shot requires explicit target impairment at impact and ready rune procs: 10–45 true damage, four-second cooldown. This condition describes every scored impact; the model does not infer CC from the selected spell.');
 mark(runes.has(8143),'Sudden Impact','One explicitly armed Sudden Impact within its four-second opening window adds 20–80 true damage. No dash, blink, stealth exit or re-arming is inferred from an ability name.');
 mark(ids.has(3153),'Blade of the Ruined King Mist’s Edge','Mist’s Edge adds the source current-health term: 9% melee / 6% ranged physical damage on eligible deliveries, with reduced on-hit effectiveness when specified. Target HP is sampled at this proc’s modeled impact, after its native packet and earlier procs. Minimum-damage floor, slow and exact client ordering remain unverified and excluded.');
 mark(ids.has(3091),'Wit’s End Fray','Fray adds the current source 45 magic damage on eligible on-hit deliveries, respecting reduced effectiveness. Tenacity and attack timing are outside damage scoring.');
 mark(ids.has(3124),'Guinsoo’s Rageblade Wrath','Wrath adds 30 magic damage per eligible delivery. Entered Seething Strike stacks supply attack speed separately. Phantom Hit, automatic stack generation and duplicated champion on-hits remain excluded; this is not a complete Rageblade model.');
 return {notes,implemented,onHit(hit:ProcHit):ProcPacket[]{
  const out:ProcPacket[]=[];
  const emit=(name:string,type:ProcHit['type'],raw:number,origin:ProcPacket['origin'],extra:Partial<ProcPacket>={})=>{if(raw>0&&Number.isFinite(raw))out.push({name,time:hit.time,type,raw,origin,...extra})};
  const spell=hit.spellEffects??hit.kind==='ability',attack=hit.kind==='attack';
  const delivery=hit.appliesOnHit??(attack||hit.kind==='on-hit');
  const effectiveness=Number.isFinite(hit.onHitMultiplier)?Math.max(0,Math.min(1,hit.onHitMultiplier!)):1;
  const action=hit.castId??(attack?`attack@${hit.time}`:'selected-cast');
  if(ready&&runes.has(8005)&&delivery&&effectiveness>0&&!e.ptaActive&&hit.time>=ptaAt){
   if(ptaLast!==-Infinity&&hit.time-ptaLast>4)ptaHits=0;
   ptaLast=hit.time;
   if(++ptaHits>=3){emit('Press the Attack',adaptive(hit),lerp(40,160),'rune',{activatesPTA:true,excludePTA:true});ptaHits=0;ptaAt=hit.time+6;}
  }
  if(ready&&runes.has(8437)&&e.graspReady&&delivery&&effectiveness>0&&!graspUsed){
   emit('Grasp of the Undying','magic',.035*stats.hp*(ranged?.4:1)*effectiveness,'rune');graspUsed=true;
  }
  if(ready&&runes.has(8112)&&(spell||attack||delivery)&&!electroSeen.has(action)){
   electroSeen.add(action);
   if(hit.time>=electroAt){
    electroHits=electroHits.filter(h=>hit.time-h.time<=3);electroHits.push({id:action,time:hit.time});
    if(electroHits.length>=3){emit('Electrocute',adaptive(hit),lerp(70,240)+.1*stats.bonusAD+.05*stats.ap,'rune');electroHits=[];electroAt=hit.time+20;}
   }
  }
  if(ready&&runes.has(8126)&&e.targetImpaired&&hit.time>=cheapAt){emit('Cheap Shot','true',lerp(10,45),'rune');cheapAt=hit.time+4;}
  if(ready&&runes.has(8143)&&e.suddenImpactArmed&&!impactUsed&&hit.time<4){emit('Sudden Impact','true',lerp(20,80),'rune');impactUsed=true;}
  if(itemReady&&delivery&&effectiveness>0){
   if(ids.has(3153)){const ratio=(ranged?.06:.09)*effectiveness;emit('Blade of the Ruined King Mist’s Edge','physical',Math.max(0,s.targetHP*hit.targetHealthPercent/100)*ratio,'item',{currentHPRatio:ratio});}
   if(ids.has(3091))emit('Wit’s End Fray','magic',45*effectiveness,'item');
   if(ids.has(3124))emit('Guinsoo’s Rageblade Wrath','magic',30*effectiveness,'item');
  }
  return out;
 }};
}
