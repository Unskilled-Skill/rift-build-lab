// Derives when real players buy each item from the OP.GG/Lolalytics records (ranked Emerald+):
// observed core items sit at slots 1-3 in purchase order, observed options at slots 4-6, weighted by matches.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

// --records <dir> pins provider-research to one version directory (reproducible output); otherwise index.json decides.
const pinned = process.argv.includes('--records') ? process.argv[process.argv.indexOf('--records') + 1] : undefined;
function records(base) {
  const indexPath = `public/data/${base}/index.json`;
  if (!fs.existsSync(path.join(ROOT, indexPath))) return [];
  const index = read(indexPath), dir = `public/data/${base}/${base === 'provider-research' && pinned ? pinned : index.recordsDirectory}`;
  if (!fs.existsSync(path.join(ROOT, dir))) return [];
  return fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.json')).flatMap(f => {
    const raw = read(`${dir}/${f}`);
    return Array.isArray(raw.sources) ? raw.sources : Array.isArray(raw.roles) ? raw.roles.flatMap(r => r.sources || []) : [];
  });
}

export function itemTiming(sources, itemIds) {
  const add = (map, id, slot, weight) => { if (!itemIds.has(id) || !(weight > 0)) return; const e = map.get(id) || { sum: 0, weight: 0 }; e.sum += slot * weight; e.weight += weight; map.set(id, e); };
  const global = new Map(), champions = new Map(), seen = new Set(), roles = new Map();
  let games = 0;
  for (const s of sources) {
    if (s?.status !== 'available' || !Array.isArray(s.observedCoreItemIds)) continue;
    const key = `${s.champion}/${s.role}/${s.provider}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const core = s.coreBuildMatches || s.matches || 0;
    const played = roles.get(s.champion) || {};
    played[s.role] = Math.max(played[s.role] || 0, s.matches || core);
    roles.set(s.champion, played);
    games += s.matches || 0;
    const own = champions.get(s.champion) || new Map();
    champions.set(s.champion, own);
    s.observedCoreItemIds.forEach((id, n) => { add(global, id, n + 1, core); add(own, id, n + 1, core); });
    for (const row of s.observedItemOptions || []) for (const option of row.items || []) { add(global, option.id, row.slot, option.matches); add(own, option.id, row.slot, option.matches); }
  }
  const flatten = (map) => Object.fromEntries([...map].sort((a, b) => a[0] - b[0]).map(([id, e]) => [id, { slot: Math.round(e.sum / e.weight * 100) / 100, matches: Math.round(e.weight) }]));
  const ranked = Object.fromEntries([...roles].sort().map(([c, r]) => [c, Object.entries(r).sort((a, b) => b[1] - a[1]).map(([role, matches]) => ({ role, matches }))]));
  return { global: flatten(global), champions: Object.fromEntries([...champions].sort().map(([c, m]) => [c, flatten(m)])), roles: ranked, sources: seen.size, games };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = read('public/data/catalog.json'), index = read('public/data/provider-research/index.json');
  const timing = itemTiming([...records('provider-research'), ...records('provider-roles')], new Set(catalog.items.map(i => i.id)));
  const out = { version: 1, patch: index.patch, checkedAt: index.checkedAt, basis: 'OP.GG and Lolalytics ranked Emerald+ purchase order: core items at slots 1-3, top options at slots 4-6, weighted by matches.', ...timing };
  fs.writeFileSync(path.join(ROOT, 'public/data/item-timing.json'), JSON.stringify(out) + '\n');
  console.log(`Item timing: ${Object.keys(out.global).length} items across ${out.sources} provider records.`);
}
