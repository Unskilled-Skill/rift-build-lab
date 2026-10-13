import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const PROVIDERS = ['opgg', 'lolalytics'];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const validDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;

export function validateSources(catalog, providers, baselines = []) {
  const items = new Set(catalog.items.map(i => i.id));
  const runes = new Map(catalog.runes.map(r => [r.id, r]));
  const roles = new Map(baselines.map(b => [b.champion, b.role === 'bot' ? 'adc' : b.role]));
  for (const [n, entries] of providers.entries()) {
    const aliases = new Set(entries.map(s => s.champion));
    if (entries.length !== catalog.champions.length || aliases.size !== catalog.champions.length || catalog.champions.some(c => !aliases.has(c.alias))) throw new Error('Provider collection must cover the exact roster before publishing.');
    for (const s of entries) {
      const fail = (message) => { throw new Error(`${s.champion}/${PROVIDERS[n]}: ${message}`); };
      if (s.provider !== PROVIDERS[n] || s.status !== 'available') fail('Incomplete source acquisition.');
      if (!['top', 'jungle', 'mid', 'adc', 'support'].includes(s.role) || (roles.has(s.champion) && roles.get(s.champion) !== s.role)) fail('Invalid source role.');
      for (const key of ['role', 'checkedAt', 'limits']) if (typeof s[key] !== 'string' || !s[key].trim() || s[key].length > 2000) fail('Invalid provider text.');
      if (!validDate(s.checkedAt) || typeof s.sourcePatch !== 'string' || !/^\d+\.\d+$/.test(s.sourcePatch)) fail('Invalid source date or patch.');
      if (typeof s.selection !== 'string' || !s.selection.trim() || s.selection.length > 300) fail('Invalid source selection.');
      if (typeof s.limits !== 'string' || !s.limits.includes('Emerald+') || !/Ranked|Solo\/Duo/.test(s.limits) || !s.selection) fail('Source context is missing.');
      const expected = n === 0 ? 'https://op.gg/open-source/opgg-mcp' : `https://lolalytics.com/lol/${s.champion === 'MonkeyKing' ? 'wukong' : s.champion.toLowerCase()}/build/`;
      if (s.sourceURL !== expected && !(n === 1 && ['top', 'middle', 'bottom', 'support', 'jungle'].some(role => s.sourceURL === `${expected}?lane=${role}`))) fail('Invalid provider URL.');
      if (s.context && (s.context.tier !== 'emerald_plus' || s.context.gameMode !== 'ranked' || s.context.queue !== 'solo_duo' || s.context.region !== (n === 0 ? 'unverified' : 'global'))) fail('Source context differs from requested scope.');
      if (!Array.isArray(s.observedCoreItemIds) || !s.observedCoreItemIds.length || s.observedCoreItemIds.length > 8 || new Set(s.observedCoreItemIds).size !== s.observedCoreItemIds.length || s.observedCoreItemIds.some(id => !Number.isInteger(id) || !items.has(id)) || (s.bootsId != null && !items.has(s.bootsId))) fail('Unknown or invalid local item IDs.');
      const page = s.observedRunePage;
      if (!Array.isArray(page) || page.length !== 6 || new Set(page).size !== 6 || page.some(id => !Number.isInteger(id) || !runes.has(id))) fail('Incomplete rune page.');
      const primary = catalog.trees.find(t => t.slots[0].runes.some(r => r.id === page[0]));
      const secondary = primary && catalog.trees.find(t => t.id !== primary.id && t.slots.slice(1).some(slot => slot.runes.some(r => r.id === page[4])));
      const rows = secondary && page.slice(4).map(id => secondary.slots.findIndex(slot => slot.runes.some(r => r.id === id)));
      const legal = primary && page.slice(0, 4).every((id, n) => primary.slots[n].runes.some(r => r.id === id)) && rows && rows.every(n => n > 0) && rows[0] !== rows[1];
      if (!legal) fail('Illegal rune tree or slot selection.');
      for (const key of ['coreBuildMatches', 'coreBuildWins', 'matches', 'keystoneMatches']) if ((key === 'coreBuildMatches' || s[key] != null) && (!Number.isInteger(s[key]) || s[key] < (key === 'coreBuildMatches' ? 1 : 0) || s[key] > 100000000)) fail('Invalid provider sample count.');
      if (s.matches != null && s.matches < s.coreBuildMatches) fail('Invalid cohort sample.');
      if (s.coreBuildWinRate !== undefined && (!Number.isFinite(s.coreBuildWinRate) || s.coreBuildWinRate < 0 || s.coreBuildWinRate > 100)) fail('Invalid source win rate.');
      if (s.keystoneWinRate != null && (!Number.isFinite(s.keystoneWinRate) || s.keystoneWinRate < 0 || s.keystoneWinRate > 100)) fail('Invalid keystone win rate.');
      if (s.coreBuildWins != null && (!Number.isInteger(s.coreBuildWins) || s.coreBuildWins < 0 || s.coreBuildWins > s.coreBuildMatches)) fail('Invalid source wins.');
    }
  }
  for (const s of providers[0]) if (providers[1].find(t => t.champion === s.champion).role !== s.role) throw new Error(`${s.champion}: provider roles differ.`);
  const dates = new Set(providers.flatMap(entries => entries.map(s => s.checkedAt)));
  if (dates.size !== 1) throw new Error('Provider check dates must agree.');
  return [...dates][0];
}

function publicationPaths(root, transaction, marker) {
  const absoluteRoot = fs.realpathSync(path.resolve(root));
  const runRoot = path.resolve(absoluteRoot, 'data/provider-refresh/runs');
  const target = path.resolve(absoluteRoot, 'public/data/provider-research');
  const previous = path.join(transaction, 'previous');
  const staged = path.join(transaction, 'snapshot');
  if (path.dirname(transaction) !== runRoot || !/^publish-[\w-]+$/.test(path.basename(transaction)) || marker.version !== 1 || marker.target !== target || marker.previous !== previous || marker.staged !== staged) throw new Error('Unsafe publication recovery marker.');
  // Check existing paths and their nearest existing ancestors, including symlinks,
  // before any directory rename. Every resolved path must remain in this root.
  for (const candidate of [transaction, target, previous, staged]) {
    let existing = candidate;
    while (!fs.existsSync(existing)) existing = path.dirname(existing);
    const real = fs.realpathSync(existing);
    const relative = path.relative(absoluteRoot, real);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Publication path escapes workspace.');
  }
  return { target, previous, staged };
}

export function recoverProviderPublication(root = ROOT) {
  root = fs.realpathSync(path.resolve(root));
  const runRoot = path.resolve(root, 'data/provider-refresh/runs');
  if (!fs.existsSync(runRoot)) return [];
  const recovered = [];
  for (const entry of fs.readdirSync(runRoot, { withFileTypes: true })) {
    if (!entry.name.startsWith('publish-')) continue;
    const transaction = path.join(runRoot, entry.name);
    const markerPath = path.join(transaction, 'publication.json');
    if (!fs.existsSync(markerPath)) continue;
    const marker = read(markerPath);
    const { target, previous } = publicationPaths(root, transaction, marker);
    if (!fs.existsSync(target) && fs.existsSync(previous)) {
      fs.renameSync(previous, target);
      recovered.push(target);
    }
    fs.renameSync(markerPath, path.join(transaction, 'publication.resolved.json'));
  }
  return recovered;
}

function preparePublication(root, inputDir, now) {
  const catalog = read(path.join(root, 'public/data/catalog.json'));
  const providers = PROVIDERS.map(p => read(path.join(inputDir, `${p}.json`)));
  const baselinePath = path.join(root, 'scripts/meta-baselines.json');
  const checkedAt = validateSources(catalog, providers, fs.existsSync(baselinePath) ? read(baselinePath) : []);
  const prepared = catalog.champions.map(c => ({ version: 1, patch: catalog.patch, champion: c.alias, sources: providers.map(entries => entries.find(s => s.champion === c.alias)) }));
  if (prepared.some(p => JSON.stringify(p, null, 2).length + 1 > 100000)) throw new Error('Provider snapshot is too large.');
  const summary = { version: 1, patch: catalog.patch, checkedAt, updatedAt: now().toISOString(), championCount: prepared.length, providers: Object.fromEntries(PROVIDERS.map((p, n) => [p, { available: providers[n].length, unavailable: [], sourcePatches: [...new Set(providers[n].map(s => s.sourcePatch))].sort() }])) };
  return { prepared, summary };
}

export function publishProviderResearchVersioned({ root = ROOT, inputDir = path.join(root, 'scripts/provider-research'), io = fs, now = () => new Date() } = {}) {
  root = fs.realpathSync(path.resolve(root));
  const { prepared, summary } = preparePublication(root, inputDir, now);
  const target = path.resolve(root, 'public/data/provider-research');
  const runRoot = path.resolve(root, 'data/provider-refresh/runs');
  const id = randomUUID();
  const recordsDirectory = `versions/${id}`;
  const records = path.join(target, 'versions', id);
  // Validate resolved ancestors before writes; immutable records stay unreferenced
  // until the final manifest rename commits the entire prepared collection.
  for (const candidate of [target, records, runRoot]) {
    let existing = candidate;
    while (!fs.existsSync(existing)) existing = path.dirname(existing);
    const relative = path.relative(root, fs.realpathSync(existing));
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Publication path escapes workspace.');
  }
  io.mkdirSync(runRoot, { recursive: true });
  const transaction = io.mkdtempSync(path.join(runRoot, 'manifest-'));
  const manifest = path.join(transaction, 'index.json');
  io.mkdirSync(records, { recursive: true });
  for (const p of prepared) io.writeFileSync(path.join(records, `${p.champion}.json`), JSON.stringify(p, null, 2) + '\n', { flag: 'wx' });
  const result = { ...summary, recordsDirectory };
  io.writeFileSync(manifest, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  // File replacement is atomic on the same volume. Never rename watched folders
  // or remove old versions, so existing requests can finish against their index.
  io.renameSync(manifest, path.join(target, 'index.json'));
  return result;
}

export function publishProviderResearch({ root = ROOT, inputDir = path.join(root, 'scripts/provider-research'), io = fs, now = () => new Date() } = {}) {
  root = fs.realpathSync(path.resolve(root));
  recoverProviderPublication(root);
  const { prepared, summary } = preparePublication(root, inputDir, now);
  // Stage and preserve backups outside the static asset tree. No recursive deletion.
  const runRoot = path.resolve(root, 'data/provider-refresh/runs');
  io.mkdirSync(runRoot, { recursive: true });
  const transaction = io.mkdtempSync(path.join(runRoot, 'publish-'));
  const staged = path.join(transaction, 'snapshot');
  const previous = path.join(transaction, 'previous');
  const target = path.resolve(root, 'public/data/provider-research');
  io.mkdirSync(staged);
  for (const p of prepared) io.writeFileSync(path.join(staged, `${p.champion}.json`), JSON.stringify(p, null, 2) + '\n');
  io.writeFileSync(path.join(staged, 'index.json'), JSON.stringify(summary, null, 2) + '\n');
  const markerPath = path.join(transaction, 'publication.json');
  const marker = { version: 1, target, previous, staged };
  publicationPaths(root, transaction, marker);
  io.writeFileSync(markerPath, JSON.stringify(marker) + '\n');
  let movedPrevious = false;
  try {
    if (io.existsSync(target)) { io.renameSync(target, previous); movedPrevious = true; }
    io.renameSync(staged, target);
  } catch (error) {
    if (movedPrevious) {
      try { io.renameSync(previous, target); }
      catch (rollbackError) { throw new AggregateError([error, rollbackError], `Publication failed; previous snapshot preserved at ${previous}.`); }
    }
    throw error;
  }
  // The snapshot is committed. A marker cleanup failure must not turn a
  // successful publication into a failed job; startup can resolve it safely.
  try { io.renameSync(markerPath, path.join(transaction, 'publication.resolved.json')); } catch {}
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--input-dir')) throw new Error('Usage: node scripts/prepare-provider-research.mjs [--input-dir DIRECTORY]');
  console.log(JSON.stringify(publishProviderResearchVersioned({ inputDir: args.length ? path.resolve(args[1]) : undefined })));
}
