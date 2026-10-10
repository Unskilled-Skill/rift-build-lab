import {searchBuilds} from './search';
self.onmessage=({data})=>{try{const result=searchBuilds(data.champion,data.pool,data.scenario,data.locks,data.excluded,100000,count=>self.postMessage({kind:'progress',count}));self.postMessage({kind:'done',...result});}catch(error){self.postMessage({kind:'error',message:error instanceof Error?error.message:'Search failed'});}};
