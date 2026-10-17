export interface Chunk {file:string;isEntry?:boolean;isDynamicEntry?:boolean;imports?:string[];dynamicImports?:string[]}
export function assertAnalysisChunks(manifest:Record<string,Chunk>):void;
