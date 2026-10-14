import type {Champion} from './types';
export interface CompDraft {version:1;allySlots?:string[];enemySlots?:string[];alliesText:string;enemiesText:string;enemyArmor:boolean;enemyMR:boolean;enemyHealing:boolean;enemyShields:boolean;priority?:'balanced'|'damage'|'survival';mainThreat?:string;laneOpponent?:string;lockedItemIds?:number[]}
export const emptyCompDraft=():CompDraft=>({version:1,alliesText:'',enemiesText:'',enemyArmor:false,enemyMR:false,enemyHealing:false,enemyShields:false});
const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const shorthand:Record<string,string>={wukong:'MonkeyKing',nunu:'Nunu',tahm:'TahmKench',blitz:'Blitzcrank',mundo:'DrMundo',asol:'AurelionSol',aurelion:'AurelionSol',renata:'Renata',tf:'TwistedFate',j4:'JarvanIV',jarvan:'JarvanIV',yi:'MasterYi',mf:'MissFortune',cho:'Chogath'};
export function parseTeamText(text:string,champions:Champion[],max:number):string[]{
 if(text.length>1000)throw new Error('Team text is too long.');
 const tokens=text.split(/[,;\n]+/).map(v=>v.trim()).filter(Boolean);if(tokens.length>max)throw new Error(`Enter at most ${max} champions, separated by commas.`);
 const aliases=tokens.map(token=>{const key=normalize(token);const c=champions.find(c=>normalize(c.alias)===key||normalize(c.name)===key||c.alias===shorthand[key]);if(!c)throw new Error(`Unknown champion: ${token}. Use the full name, separated by commas.`);return c.alias});
 if(new Set(aliases).size!==aliases.length)throw new Error('A team contains a duplicate champion.');return aliases;
}
export function parseCompDraft(text:string):CompDraft{
 if(text.length>5000)throw new Error('Composition draft is too large.');const input=JSON.parse(text);
 if(input.version!==1||typeof input.alliesText!=='string'||typeof input.enemiesText!=='string'||input.alliesText.length>1000||input.enemiesText.length>1000)throw new Error('Invalid composition draft.');
 const result=emptyCompDraft();result.alliesText=input.alliesText;result.enemiesText=input.enemiesText;
 for(const key of ['enemyArmor','enemyMR','enemyHealing','enemyShields'] as const)if(input[key]!==undefined){if(typeof input[key]!=='boolean')throw new Error('Invalid threat override.');result[key]=input[key]}
 for(const [key,count] of [['allySlots',4],['enemySlots',5]] as const)if(input[key]!==undefined){if(!Array.isArray(input[key])||input[key].length!==count||input[key].some((s:unknown)=>typeof s!=='string'||s.length>80))throw new Error('Invalid team slots.');result[key]=input[key]}
 for(const key of ['mainThreat','laneOpponent'] as const)if(input[key]!==undefined){if(typeof input[key]!=='string'||input[key].length>80)throw new Error('Invalid selected threat.');result[key]=input[key]}
 if(input.priority!==undefined){if(!['balanced','damage','survival'].includes(input.priority))throw new Error('Invalid priority.');result.priority=input.priority}
 if(input.lockedItemIds!==undefined){if(!Array.isArray(input.lockedItemIds)||input.lockedItemIds.length>6||input.lockedItemIds.some((id:unknown)=>!Number.isInteger(id)))throw new Error('Invalid item locks.');result.lockedItemIds=input.lockedItemIds}
 return result;
}

export function teamPickerOptions(query:string,champions:Champion[],excluded:string[]):Champion[]{const key=normalize(query);return champions.filter(c=>!excluded.includes(c.alias)&&(!key||normalize(c.name).includes(key)||normalize(c.alias).includes(key)||c.alias===shorthand[key]));}
export function replaceTeamSlot(slots:string[],index:number,alias:string,unavailable:string[]):string[]{if(index<0||index>=slots.length)throw new Error('Invalid team slot.');if(alias&&alias!==slots[index]&&unavailable.includes(alias))throw new Error('Champion already selected.');return slots.map((value,n)=>n===index?alias:value);}
