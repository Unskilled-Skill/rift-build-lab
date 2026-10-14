import { it as test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepareRoleCatalog, publishProviderRoles } from '../scripts/prepare-provider-roles.mjs';
import { parseProviderResearch } from '../src/provider-research';
const catalog = JSON.parse(fs.readFileSync('public/data/catalog.json'));
const pair = () => ['opgg','lolalytics'].map(p => ({...JSON.parse(fs.readFileSync(`scripts/provider-research/${p}.json`)).find(r => r.champion === 'Ahri'),context:{gameMode:'ranked',tier:'emerald_plus',queue:'solo_duo',region:p === 'opgg' ? 'unverified' : 'global'}}));
test('qualified observations publish one actual role without synthesizing other lanes', () => {
  const result = prepareRoleCatalog(catalog, pair());
  assert.deepEqual(result.index.champions, { Ahri: ['mid'] });
  assert.equal(result.records[0].roles[0].sources.length, 2);
  assert.equal(result.index.minimumRoleMatches, 1000);
  assert.equal(result.index.minimumCoreBuildMatches, 100);
});
for (const [name, change] of [
  ['missing provider', p => p.pop()],
  ['duplicate provider', p => p.push(p[0])],
  ['role mismatch', p => { p[0].role='support'; }],
  ['wrong explicit lane', p => { p[1].sourceURL='https://lolalytics.com/lol/ahri/build/?lane=top'; }],
  ['missing scope', p => { delete p[0].context; }],
  ['unavailable source', p => { p[0].status='unavailable'; }],
  ['small role sample', p => { p[1].matches=999; p[1].coreBuildMatches=100; }],
  ['small core sample', p => { p[0].coreBuildMatches=99; p[0].coreBuildWins=50; }],
  ['unknown item', p => { p[0].observedCoreItemIds=[-1]; }],
]) test(`optional roles reject ${name}`, () => {
  const sources=pair();change(sources);
  assert.throws(() => prepareRoleCatalog(catalog,sources));
});
test('an empty optional collection publishes no selectable roles', () => {
  assert.deepEqual(prepareRoleCatalog(catalog,[]).index.champions,{});
});
test('bundled alternate observations are valid backwards-compatible provider pairs', () => {
  const sources=JSON.parse(fs.readFileSync('scripts/provider-roles/observations.json'));
  const result=prepareRoleCatalog(catalog,sources);
  for (const record of result.records) for (const role of record.roles) {
    assert.equal(parseProviderResearch(JSON.stringify({...record,sources:role.sources}),catalog,record.champion).length,2);
    assert.ok(role.sources.every(s => s.role===role.role));
    assert.equal(role.sources[0].sampleScope,'champion_summary_unverified');
    assert.equal(role.sources[1].sampleScope,'champion_role');
  }
});
test('invalid refresh retains published optional index and records', t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'riot-roles-'));
  t.onTestFinished(() => fs.rmSync(root,{recursive:true}));
  fs.mkdirSync(path.join(root,'public/data'),{recursive:true});
  fs.writeFileSync(path.join(root,'public/data/catalog.json'),JSON.stringify(catalog));
  const inputFile=path.join(root,'incoming.json');
  fs.writeFileSync(inputFile,JSON.stringify(pair()));
  const manifest=publishProviderRoles({root,inputFile});
  const target=path.join(root,'public/data/provider-roles');
  const before=fs.readFileSync(path.join(target,'index.json'),'utf8');
  fs.writeFileSync(inputFile,JSON.stringify(pair().slice(1)));
  assert.throws(() => publishProviderRoles({root,inputFile}));
  assert.equal(fs.readFileSync(path.join(target,'index.json'),'utf8'),before);
  assert.equal(JSON.parse(fs.readFileSync(path.join(target,manifest.recordsDirectory,'Ahri.json'))).roles[0].role,'mid');
});
