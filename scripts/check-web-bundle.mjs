import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// The published website must not contain desktop IPC, the desktop data protocol or a desktop chunk.
const markers=['__TAURI','@tauri-apps','rbldata:','rbldata.localhost','tauri://','ipc://localhost','ipc.localhost','desktop-catalog-pages'];
export function findDesktopLeaks(files){
 const leaks=[];
 for(const {name,text} of files){
  if(/(^|\/)desktop[-.][^/]*\.js$/i.test(name)){leaks.push({file:name,marker:'desktop chunk'});continue}
  const marker=markers.find(m=>text.includes(m));if(marker)leaks.push({file:name,marker});
 }
 return leaks;
}
function scan(root,dir=root){const out=[];for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory()){if(entry.name!=='data')out.push(...scan(root,full))}else if(/\.(js|mjs|html)$/.test(entry.name))out.push({name:path.relative(root,full).split(path.sep).join('/'),text:fs.readFileSync(full,'utf8')})}return out}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const dir=process.argv[2]||'dist';const leaks=findDesktopLeaks(scan(dir));
 if(leaks.length){for(const l of leaks)console.error(`Desktop code in website bundle: ${l.file} (${l.marker})`);process.exit(1)}
 console.log('Website bundle contains no desktop code.');
}
