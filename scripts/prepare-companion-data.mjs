import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync('public/data/catalog.json','utf8'));
const catalog={patch:data.patch,dataVersion:data.version,champions:data.champions.map(({id,alias,name})=>({id,alias,name})),items:data.items.filter(i=>i.maps['11']&&i.shopListedBySource&&!/^(32|66)\d{4}$/.test(String(i.id))).map(({id,name})=>({id,name})),trees:data.trees,shardRows:[[5005,5007,5008],[5008,5010,5001],[5011,5013,5001]]};
fs.writeFileSync('companion/catalog.json',JSON.stringify(catalog,null,2)+'\n');
console.log(`Companion catalog: ${catalog.champions.length} champions, ${catalog.items.length} items, patch ${catalog.patch}`);
