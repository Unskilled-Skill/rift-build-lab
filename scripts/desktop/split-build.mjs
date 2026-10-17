// After `vite build --mode desktop`: the data snapshot ships as installer resources (served by the
// app's data protocol) rather than embedded frontend assets. Only files listed in the desktop
// manifest are kept, so stale provider versions and website-only downloads never reach the installer.
import fs from 'node:fs';
import path from 'node:path';
const out='dist-desktop',source=`${out}/data`,target='dist-desktop-data';
const manifest=JSON.parse(fs.readFileSync(`${source}/desktop/manifest.json`,'utf8'));
fs.rmSync(target,{recursive:true,force:true});
for(const file of [...manifest.files.map(f=>f.path),'desktop/manifest.json']){
 fs.mkdirSync(path.dirname(`${target}/${file}`),{recursive:true});
 fs.copyFileSync(`${source}/${file}`,`${target}/${file}`);
}
fs.rmSync(source,{recursive:true,force:true});
fs.rmSync(`${out}/downloads`,{recursive:true,force:true});
console.log(`Desktop data snapshot: ${manifest.files.length} files, revision ${manifest.revision.slice(0,12)}.`);
