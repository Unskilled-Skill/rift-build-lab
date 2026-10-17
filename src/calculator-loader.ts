export type Calculator=Pick<typeof import('./engine'),'calculate'>;
/** Load on first bench visit; view changes must not receive late async updates. */
export function connectCalculator(ready:(calculator:Calculator)=>void,failed:(error:unknown)=>void,load:()=>Promise<Calculator>=()=>import('./engine')):()=>void{
 let live=true;
 void Promise.resolve().then(load).then(calculator=>{if(live)ready(calculator)}).catch(error=>{if(live)failed(error)});
 return ()=>{live=false};
}
