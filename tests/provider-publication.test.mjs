import {it as test} from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { publishProviderResearch, publishProviderResearchVersioned, recoverProviderPublication } from '../scripts/prepare-provider-research.mjs';
import { parseProviderResearch } from '../src/provider-research';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'riot-publication-'));
  t.onTestFinished(() => {
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
    assert.ok(path.basename(resolved).startsWith('riot-publication-'));
    fs.rmSync(resolved, { recursive: true });
  });
  const target = path.join(root, 'public/data/provider-research');
  const inputDir = path.join(root, 'incoming');
  fs.mkdirSync(target, { recursive: true });
  fs.mkdirSync(inputDir);
  fs.writeFileSync(path.join(target, 'old.json'), 'previous snapshot');
  fs.writeFileSync(path.join(target, 'index.json'), '{"updatedAt":"previous"}');
  fs.copyFileSync('public/data/catalog.json', path.join(root, 'public/data/catalog.json'));
  for (const p of ['opgg', 'lolalytics']) fs.copyFileSync(`scripts/provider-research/${p}.json`, path.join(inputDir, `${p}.json`));
  return { root, inputDir, target };
}
function mutate(f, change) {
  const file = path.join(f.inputDir, 'opgg.json');
  const records = JSON.parse(fs.readFileSync(file));
  change(records);
  fs.writeFileSync(file, JSON.stringify(records));
}
function unchanged(f) {
  assert.deepEqual(fs.readdirSync(f.target).sort(), ['index.json', 'old.json']);
  assert.equal(fs.readFileSync(path.join(f.target, 'old.json'), 'utf8'), 'previous snapshot');
  assert.equal(fs.readFileSync(path.join(f.target, 'index.json'), 'utf8'), '{"updatedAt":"previous"}');
}
for (const [name, change] of [
  ['missing roster member', records => records.pop()],
  ['unavailable source', records => { records[0].status = 'unavailable'; }],
  ['unknown item', records => { records[0].observedCoreItemIds[0] = -1; }],
  ['unknown boots', records => { records[0].bootsId = -1; }],
  ['illegal rune page', records => { records[0].observedRunePage[1] = records[0].observedRunePage[0]; }],
  ['invalid date', records => { records[0].checkedAt = '2026-02-30'; }],
  ['mismatched date', records => { records[0].checkedAt = '2026-10-12'; }],
  ['mismatched role', records => { records[0].role = 'support'; }],
  ['wrong context', records => { records[0].context = { tier: 'gold' }; }],
  ['three-part patch', records => { records[0].sourcePatch = '16.20.1'; }],
  ['duplicate core item', records => { records[0].observedCoreItemIds.push(records[0].observedCoreItemIds[0]); }],
  ['nine core items', records => { records[0].observedCoreItemIds = [1001, 1004, 1006, 1011, 1018, 1026, 1027, 1028, 1029]; }],
  ['oversize limits', records => { records[0].limits += 'a'.repeat(2001); }],
  ['oversize selection', records => { records[0].selection = 'a'.repeat(301); }],
  ['nontext selection', records => { records[0].selection = {}; }],
  ['whitespace selection', records => { records[0].selection = ' '; }],
  ['wrong URL path', records => { records[0].sourceURL = 'https://op.gg/another-path'; }],
  ['oversize sample', records => { records[0].coreBuildMatches = 100000001; }],
  ['negative keystone sample', records => { records[0].keystoneMatches = -1; }],
  ['fractional keystone sample', records => { records[0].keystoneMatches = 1.5; }],
  ['oversize keystone sample', records => { records[0].keystoneMatches = 100000001; }],
  ['invalid keystone rate', records => { records[0].keystoneWinRate = 101; }],
  ['null core win rate', records => { records[0].coreBuildWinRate = null; }],
]) test(`${name} retains every previous public file`, t => {
  const f = fixture(t);
  mutate(f, change);
  assert.throws(() => publishProviderResearch(f));
  unchanged(f);
});

test('complete publish replaces whole directory and records actual publication time', t => {
  const f = fixture(t);
  // Source patch is independent of local catalog patch; known IDs remain valid.
  mutate(f, records => { records[0].sourcePatch = '16.21'; });
  const now = new Date('2026-10-14T12:34:56.789Z');
  const summary = publishProviderResearch({ ...f, now: () => now });
  assert.equal(summary.updatedAt, now.toISOString());
  assert.equal(summary.checkedAt, '2026-10-13');
  assert.ok(summary.providers.opgg.sourcePatches.includes('16.21'));
  assert.equal(fs.readdirSync(f.target).length, summary.championCount + 1);
  assert.ok(!fs.existsSync(path.join(f.target, 'old.json')));
  for (const file of fs.readdirSync(f.target).filter(x => x !== 'index.json')) {
    const text = fs.readFileSync(path.join(f.target, file), 'utf8');
    const record = JSON.parse(text);
    assert.equal(record.sources.length, 2);
    assert.ok(record.sources.every(s => s.status === 'available'));
    const catalog = JSON.parse(fs.readFileSync(path.join(f.root, 'public/data/catalog.json')));
    assert.equal(parseProviderResearch(text, catalog, record.champion).length, 2);
  }
  const transactions = fs.readdirSync(path.join(f.root, 'data/provider-refresh/runs'));
  assert.equal(fs.readFileSync(path.join(f.root, 'data/provider-refresh/runs', transactions[0], 'previous/old.json'), 'utf8'), 'previous snapshot');
});

test('staging write failure preserves previous directory', t => {
  const f = fixture(t);
  const io = { ...fs, writeFileSync() { throw new Error('simulated disk full'); } };
  assert.throws(() => publishProviderResearch({ ...f, io }), /disk full/);
  unchanged(f);
});

test('final directory rename failure rolls back every previous file', t => {
  const f = fixture(t);
  const io = { ...fs, renameSync(from, to) {
    if (path.basename(from) === 'snapshot') throw new Error('simulated final swap failure');
    return fs.renameSync(from, to);
  } };
  assert.throws(() => publishProviderResearch({ ...f, io }), /final swap failure/);
  unchanged(f);
});

test('startup recovery restores entire previous snapshot after interrupted swap', t => {
  const f = fixture(t);
  const io = { ...fs, renameSync(from, to) {
    if (['snapshot', 'previous'].includes(path.basename(from))) throw new Error('interrupted publication');
    return fs.renameSync(from, to);
  } };
  assert.throws(() => publishProviderResearch({ ...f, io }), AggregateError);
  assert.ok(!fs.existsSync(f.target));
  assert.deepEqual(recoverProviderPublication(f.root), [f.target]);
  unchanged(f);
  assert.deepEqual(recoverProviderPublication(f.root), []);
});

test('recovery marker cleanup failure retains successful committed snapshot', t => {
  const f = fixture(t);
  const io = { ...fs, renameSync(from, to) {
    if (path.basename(from) === 'publication.json') throw new Error('marker resolution interrupted');
    return fs.renameSync(from, to);
  } };
  const summary = publishProviderResearch({ ...f, io });
  assert.equal(fs.readdirSync(f.target).length, summary.championCount + 1);
  assert.deepEqual(recoverProviderPublication(f.root), []);
  assert.equal(fs.readdirSync(f.target).length, summary.championCount + 1);
});

test('recovery refuses an absolute marker pointing outside intended workspace', t => {
  const f = fixture(t);
  const runRoot = path.join(f.root, 'data/provider-refresh/runs');
  fs.mkdirSync(runRoot, { recursive: true });
  const transaction = fs.mkdtempSync(path.join(runRoot, 'publish-'));
  fs.writeFileSync(path.join(transaction, 'publication.json'), JSON.stringify({ version: 1, target: path.join(os.tmpdir(), 'outside-public'), previous: path.join(transaction, 'previous'), staged: path.join(transaction, 'snapshot') }));
  assert.throws(() => recoverProviderPublication(f.root), /Unsafe publication recovery marker/);
  unchanged(f);
});

function priorManifestRetained(f) {
  assert.equal(fs.readFileSync(path.join(f.target, 'index.json'), 'utf8'), '{"updatedAt":"previous"}');
  assert.equal(fs.readFileSync(path.join(f.target, 'old.json'), 'utf8'), 'previous snapshot');
}

test('versioned manifest commit points to complete immutable records and preserves prior versions', t => {
  const f = fixture(t);
  const catalog = JSON.parse(fs.readFileSync(path.join(f.root, 'public/data/catalog.json')));
  let commits = 0;
  const io = { ...fs, renameSync(from, to) {
    assert.equal(to, path.join(f.target, 'index.json'));
    const summary = JSON.parse(fs.readFileSync(from));
    assert.match(summary.recordsDirectory, /^versions\/[0-9a-f-]{36}$/);
    const records = path.join(f.target, summary.recordsDirectory);
    assert.equal(fs.readdirSync(records).length, catalog.champions.length);
    for (const c of catalog.champions) assert.equal(parseProviderResearch(fs.readFileSync(path.join(records, `${c.alias}.json`), 'utf8'), catalog, c.alias).length, 2);
    if (!commits) priorManifestRetained(f);
    commits++;
    return fs.renameSync(from, to);
  } };
  const first = publishProviderResearchVersioned({ ...f, io, now: () => new Date('2026-10-14T15:00:00Z') });
  assert.equal(first.updatedAt, '2026-10-14T15:00:00.000Z');
  assert.equal(first.checkedAt, '2026-10-13');
  const firstAatrox = fs.readFileSync(path.join(f.target, first.recordsDirectory, 'Aatrox.json'), 'utf8');
  const second = publishProviderResearchVersioned({ ...f, io });
  assert.notEqual(first.recordsDirectory, second.recordsDirectory);
  assert.equal(fs.readFileSync(path.join(f.target, first.recordsDirectory, 'Aatrox.json'), 'utf8'), firstAatrox);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.target, 'index.json'))), second);
  assert.equal(commits, 2);
  assert.equal(fs.readFileSync(path.join(f.target, 'old.json'), 'utf8'), 'previous snapshot');
});

test('versioned validation failure leaves manifest and prior records untouched', t => {
  const f = fixture(t);
  mutate(f, records => { records[0].sourcePatch = '16.20.1'; });
  assert.throws(() => publishProviderResearchVersioned(f));
  unchanged(f);
});

test('versioned partial record write failure retains prior manifest and records', t => {
  const f = fixture(t);
  let written = 0;
  const io = { ...fs, writeFileSync(file, ...args) {
    if (++written === 2) throw new Error('simulated record write failure');
    return fs.writeFileSync(file, ...args);
  } };
  assert.throws(() => publishProviderResearchVersioned({ ...f, io }), /record write failure/);
  priorManifestRetained(f);
});

test('versioned manifest write failure retains prior manifest and records', t => {
  const f = fixture(t);
  const io = { ...fs, writeFileSync(file, ...args) {
    if (path.basename(file) === 'index.json') throw new Error('simulated manifest write failure');
    return fs.writeFileSync(file, ...args);
  } };
  assert.throws(() => publishProviderResearchVersioned({ ...f, io }), /manifest write failure/);
  priorManifestRetained(f);
});

test('versioned atomic manifest replacement failure retains prior manifest and records', t => {
  const f = fixture(t);
  const io = { ...fs, renameSync() { throw new Error('simulated manifest swap EPERM'); } };
  assert.throws(() => publishProviderResearchVersioned({ ...f, io }), /manifest swap EPERM/);
  priorManifestRetained(f);
});
