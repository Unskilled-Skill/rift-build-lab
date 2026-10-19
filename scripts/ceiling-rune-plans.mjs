// Explicit per-ability rune reviews. These checks do not simulate rune damage.
export function validateCeilingRunePlan(entry,catalog,resources){
 const p=entry.runePlan;
 if(!p||p.target!==entry.targetName||typeof p.reviewedAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.reviewedAt)||!Number.isFinite(Date.parse(p.reviewedAt))||new Date(p.reviewedAt).toISOString().slice(0,10)!==p.reviewedAt||p.verification!=='reasoned-candidate')throw new Error(`${entry.champion}: invalid rune review identity.`);
 const text=(v,max=1800)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 for(const k of ['objective','reason','shardReason'])if(!text(p[k]))throw new Error(`${entry.champion}: missing rune ${k}.`);
 for(const k of ['setup','alternatives','exclusions'])if(!Array.isArray(p[k])||!p[k].length||p[k].length>8||p[k].some(v=>!text(v,1000))||p[k].join(' ').length>1800)throw new Error(`${entry.champion}: invalid rune ${k}.`);
 const ids=p.runes;
 if(!Array.isArray(ids)||ids.length!==6||new Set(ids).size!==6)throw new Error('Expected six distinct reviewed runes.');
 const primary=catalog.trees.find(t=>t.slots[0].runes.some(r=>r.id===ids[0]));
 if(!primary||!ids.slice(0,4).every((id,n)=>primary.slots[n].runes.some(r=>r.id===id)))throw new Error('Invalid primary rune rows.');
 const secondary=catalog.trees.find(t=>t.id!==primary.id&&t.slots.slice(1).some(s=>s.runes.some(r=>r.id===ids[4])));
 const rows=secondary&&ids.slice(4).map(id=>secondary.slots.findIndex(s=>s.runes.some(r=>r.id===id)));
 if(!rows||rows.some(n=>n<1)||rows[0]===rows[1])throw new Error('Invalid secondary rune rows.');
 if(!Array.isArray(p.runeReasons)||p.runeReasons.length!==6||p.runeReasons.some((v,n)=>!text(v,260)||!v.startsWith(`${catalog.runes.find(r=>r.id===ids[n])?.name}:`))||p.runeReasons.join(' ').length>1500)throw new Error('Rune explanations must match the selected six runes.');
 const shardRows=[[5005,5007,5008],[5008,5010,5001],[5011,5013,5001]];
 if(!Array.isArray(p.shards)||p.shards.length!==3||p.shards.some((id,n)=>!shardRows[n].includes(id)))throw new Error('Invalid reviewed stat shards.');
 const hp=entry.conditions?.healthPercent??100;
 if(ids.includes(8233)&&hp<=70)throw new Error('Absolute Focus is inactive at this benchmark HP.');
 if(ids.includes(8299)&&hp>=60)throw new Error('Last Stand is inactive at this benchmark HP.');
 if(ids.includes(8226)&&resources[entry.champion]!=='Mana')throw new Error('Manaflow on a non-mana ceiling.');
 if(!ids.includes(8010)&&(entry.conditions?.conquerorStacks??0)>0)throw new Error('Conqueror stacks without Conqueror.');
 if(`Rune reasoning: ${p.reason} ${p.runeReasons.join(' ')}`.length>2000)throw new Error('Rune reasoning exceeds the build import text limit.');
 return p;
}
export function runeReviewSteps(p){return [
 `Rune reasoning: ${p.reason} ${p.runeReasons.join(' ')}`,
 `Rune preparation: ${p.setup.join(' ')}`,
 `Rune comparison: ${p.alternatives.join(' ')}`,
 `Stat shards: ${p.shardReason}`
];}
