import fs from 'node:fs';
import path from 'node:path';
export function validateRequest(input,catalog){
 if(!input||!catalog.champions.some(c=>c.alias===input.champion))throw new Error('Choose a known champion.');
 if(typeof input.goal!=='string'||!input.goal.trim()||input.goal.length>4000)throw new Error('Enter a build goal of 1–4000 characters.');
 if(!input.scenario||typeof input.scenario!=='object'||Array.isArray(input.scenario)||input.scenario.champion!==input.champion)throw new Error('Scenario does not match the champion.');
 if(!Array.isArray(input.items)||input.items.length>6||input.items.some(id=>!Number.isInteger(id)||!catalog.items.some(i=>i.id===id)))throw new Error('Invalid item references.');
 const collection=input.collection??'earlier';if(!['four','earlier'].includes(collection))throw new Error('Choose a known build collection.');
 const outputPath=collection==='four'?`public/data/champion-builds/${input.champion}.json`:'public/data/chatgpt-builds.json';
 return {version:1,patch:'26.20',createdAt:new Date().toISOString(),champion:input.champion,goal:input.goal.trim(),scenario:input.scenario,items:input.items,collection,outputPath,instruction:`Author ${collection==='four'?'exactly four full builds for this champion':'full builds preserving other champions'} using the current local champion/item/rune sources. Write validated proposals to ${outputPath}. Include test conditions, failure cases and limits; do not claim proven live-game optimality.`};
}
export function resolveBuildInboxPath(route,catalog){
 if(route==='/data/chatgpt-builds.json')return 'public/data/chatgpt-builds.json';
 const match=route?.match(/^\/data\/champion-builds\/([A-Za-z0-9]+)\.json$/);
 if(!match||!catalog.champions.some(c=>c.alias===match[1]))return null;
 return `public/data/champion-builds/${match[1]}.json`;
}
export function buildRequestMiddleware(root){return async(req,res,next)=>{
 const route=req.url?.split('?')[0];if(route!=='/api/build-request'&&route!=='/data/chatgpt-builds.json'&&!route?.startsWith('/data/champion-builds/'))return next();
 const send=(status,obj)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(obj));};
 if(route!=='/api/build-request'){if(req.method!=='GET')return send(405,{error:'Use GET for the build inbox.'});try{const catalog=JSON.parse(fs.readFileSync(path.join(root,'public/data/catalog.json'),'utf8'));const file=resolveBuildInboxPath(route,catalog);if(!file){if(route==='/data/champion-builds/index.json')return next();return send(404,{error:'Unknown champion inbox.'});}return send(200,JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));}catch{return send(404,{error:'No valid build inbox is available.'});}}
 if(req.method!=='POST')return send(405,{error:'Use POST to prepare a request.'});
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return send(403,{error:'Requests must come from this local app.'});
 if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'Expected JSON.'});
 try{let body='';for await(const chunk of req){body+=chunk;if(body.length>50000)return send(413,{error:'Request is too large.'});}const catalog=JSON.parse(fs.readFileSync(path.join(root,'public/data/catalog.json'),'utf8'));const request=validateRequest(JSON.parse(body),catalog);const directory=path.join(root,'data/requests');fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'latest-build-request.json'),JSON.stringify(request,null,2));send(200,{ok:true,path:'data/requests/latest-build-request.json'});}catch(e){send(400,{error:e instanceof SyntaxError?'Invalid JSON.':e.message||'Could not save the request.'});}
};}
