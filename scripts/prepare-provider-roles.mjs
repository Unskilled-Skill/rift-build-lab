import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { validateSources } from './prepare-provider-research.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(fs.readFileSync(p,'utf8'));
const ROLES = ['top','jungle','mid','adc','support'];

// Optional observations are deliberately stricter than the default roster: both
// providers must clear the role-specific core threshold. OP.GG's summary count
// can repeat across positions, so only Lolalytics supplies the role cohort gate.
export function prepareRoleCatalog(catalog, sources) {
  if (!Array.isArray(sources)) throw new Error('Expected optional role observations.');
  const groups = new Map();
  for (const s of sources) {
    if (!catalog.champions.some(c => c.alias === s.champion) || !ROLES.includes(s.role)) throw new Error('Unknown optional champion or role.');
    const key = `${s.champion}/${s.role}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const records = new Map();
  for (const entries of groups.values()) {
    const {champion,role} = entries[0];
    const providers = ['opgg','lolalytics'].map(p => entries.filter(s => s.provider === p));
    if (entries.length !== 2 || providers.some(p => p.length !== 1)) throw new Error(`${champion}/${role}: requires exactly two providers.`);
    const scopedCatalog = {...catalog,champions:catalog.champions.filter(c => c.alias === champion)};
    validateSources(scopedCatalog, providers, [{champion,role}]);
    const lane = {mid:'middle',adc:'bottom'}[role] || role;
    const slug = champion === 'MonkeyKing' ? 'wukong' : champion.toLowerCase();
    if (providers[1][0].sourceURL !== `https://lolalytics.com/lol/${slug}/build/?lane=${lane}`) throw new Error('Optional role URL must explicitly match its lane.');
    if (entries.some(s => !s.context || s.coreBuildMatches < 100) || !Number.isInteger(providers[1][0].matches) || providers[1][0].matches < 1000) throw new Error('Optional role is below the observed cohort/core threshold or lacks scope.');
    if (!records.has(champion)) records.set(champion,{version:1,patch:catalog.patch,champion,roles:[]});
    records.get(champion).roles.push({role,sources:providers.flat()});
  }
  const prepared = [...records.values()].sort((a,b) => a.champion.localeCompare(b.champion));
  for (const record of prepared) record.roles.sort((a,b) => ROLES.indexOf(a.role)-ROLES.indexOf(b.role));
  const dates = [...new Set(sources.map(s => s.checkedAt))];
  if (dates.length > 1) throw new Error('Optional role check dates must agree.');
  return { records:prepared, index:{version:1,patch:catalog.patch,checkedAt:dates[0] || null,minimumRoleMatches:1000,roleCohortProvider:'lolalytics',minimumCoreBuildMatches:100,coreSampleProviders:['opgg','lolalytics'],champions:Object.fromEntries(prepared.map(r => [r.champion,r.roles.map(r => r.role)]))} };
}

export function publishProviderRoles({root=ROOT,inputFile=path.join(root,'scripts/provider-roles/observations.json')}={}) {
  root=fs.realpathSync(root);
  const {records,index}=prepareRoleCatalog(read(path.join(root,'public/data/catalog.json')),read(inputFile));
  const target=path.join(root,'public/data/provider-roles');
  const recordsDirectory=`versions/${randomUUID()}`;
  const folder=path.join(target,recordsDirectory);
  for (const candidate of [target,folder]) {
    let ancestor=candidate;
    while (!fs.existsSync(ancestor)) ancestor=path.dirname(ancestor);
    const relative=path.relative(root,fs.realpathSync(ancestor));
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Optional role publication escapes workspace.');
  }
  fs.mkdirSync(folder,{recursive:true});
  for (const record of records) fs.writeFileSync(path.join(folder,`${record.champion}.json`),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  const manifest={...index,recordsDirectory};
  const pending=path.join(target,`index-${randomUUID()}.pending`);
  fs.writeFileSync(pending,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  fs.renameSync(pending,path.join(target,'index.json'));
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  if (args.length && (args.length!==2 || args[0]!=='--input-file')) throw new Error('Usage: node scripts/prepare-provider-roles.mjs [--input-file FILE]');
  console.log(JSON.stringify(publishProviderRoles({inputFile:args.length ? path.resolve(args[1]) : undefined})));
}
