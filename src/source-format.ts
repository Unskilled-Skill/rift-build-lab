export const clean=(s:string='')=>s.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\{\{\s*spellmodifierdescriptionappend\s*\}\}/g,'');
export const sourceNumber=(n:number)=>Number(n.toPrecision(7)).toString();
