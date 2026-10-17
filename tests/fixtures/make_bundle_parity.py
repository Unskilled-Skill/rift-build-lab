"""Regenerate tests/fixtures/bundle-parity.json from the reviewed Python companion.

Run from the repository root after `npm test` (which writes real frontend bundles):
    python tests/fixtures/make_bundle_parity.py
The Rust core must accept, reject and normalize every case exactly as companion.core does.
"""
import base64
import copy
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from companion import core  # noqa: E402

catalog = json.loads((ROOT / 'companion/catalog.json').read_text(encoding='utf-8'))
real = json.loads((ROOT / 'output/companion-contract/bundles.json').read_text(encoding='utf-8'))
meta = json.loads((ROOT / 'output/companion-contract/desktop-meta-bundles.json').read_text(encoding='utf-8'))
bases = [next(b for b in real if b['championAlias'] == 'Cassiopeia'),
         next(b for b in meta if b['championAlias'] == 'Ahri'),
         next(b for b in meta if b['championAlias'] == 'Thresh')]
base = bases[0]


def mutate(path, value):
    bundle = copy.deepcopy(base)
    target = bundle
    for key in path[:-1]:
        target = target[key]
    if value is DELETE:
        del target[path[-1]]
    else:
        target[path[-1]] = value(target[path[-1]]) if callable(value) else value
    return bundle


DELETE = object()
perks = base['runePage']['selectedPerkIds']
primary = next(t for t in catalog['trees'] if t['id'] == base['runePage']['primaryStyleId'])
secondary = next(t for t in catalog['trees'] if t['id'] == base['runePage']['subStyleId'])
same_row = [r['id'] for r in next(s for s in secondary['slots'][1:] if perks[4] in {r['id'] for r in s['runes']})['runes']]
mutations = {
    'version-2': mutate(['version'], 2),
    'version-true': mutate(['version'], True),
    'patch-mismatch': mutate(['patch'], '26.19'),
    'data-version-mismatch': mutate(['dataVersion'], '16.19.1'),
    'champion-id-string': mutate(['championId'], '69'),
    'champion-id-float': mutate(['championId'], 69.0),
    'champion-id-unknown': mutate(['championId'], 999999),
    'champion-alias-mismatch': mutate(['championAlias'], 'Ahri'),
    'build-name-empty': mutate(['buildName'], '   '),
    'build-name-control': mutate(['buildName'], 'Bad\nname'),
    'build-name-121': mutate(['buildName'], 'x' * 121),
    'build-name-120-unicode': mutate(['buildName'], 'é' * 120),
    'extra-top-level': mutate(['extra'], 1),
    'missing-labels': mutate(['labels'], DELETE),
    'title-unmanaged': mutate(['itemSet', 'title'], 'My set'),
    'maps-wrong': mutate(['itemSet', 'associatedMaps'], [12]),
    'champions-wrong': mutate(['itemSet', 'associatedChampions'], [1]),
    'map-wrong': mutate(['itemSet', 'map'], 'HA'),
    'mode-wrong': mutate(['itemSet', 'mode'], 'ARAM'),
    'sortrank-1': mutate(['itemSet', 'sortrank'], 1),
    'uid-invalid': mutate(['itemSet', 'uid'], 'not-a-uuid'),
    'uid-valid-replaced': mutate(['itemSet', 'uid'], '6f9619ff-8b86-d011-b42d-00c04fc964ff'),
    'blocks-empty': mutate(['itemSet', 'blocks'], []),
    'blocks-21': mutate(['itemSet', 'blocks'], lambda b: (b * 21)[:21]),
    'block-extra-field': mutate(['itemSet', 'blocks'], lambda b: [dict(b[0], extra=1)] + b[1:]),
    'block-type-81': mutate(['itemSet', 'blocks'], lambda b: [dict(b[0], type='x' * 81)] + b[1:]),
    'block-items-empty': mutate(['itemSet', 'blocks'], lambda b: [dict(b[0], items=[])] + b[1:]),
    'item-unknown': mutate(['itemSet', 'blocks'], lambda b: [dict(b[0], items=[{'id': '999999', 'count': 1}])] + b[1:]),
    'item-id-int': mutate(['itemSet', 'blocks'], lambda b: [dict(b[0], items=[{'id': int(b[0]['items'][0]['id']), 'count': 1}])] + b[1:]),
    'count-0': mutate(['itemSet', 'blocks'], lambda b: [dict(b[0], items=[dict(b[0]['items'][0], count=0)])] + b[1:]),
    'count-10': mutate(['itemSet', 'blocks'], lambda b: [dict(b[0], items=[dict(b[0]['items'][0], count=10)])] + b[1:]),
    'count-float': mutate(['itemSet', 'blocks'], lambda b: [dict(b[0], items=[dict(b[0]['items'][0], count=1.0)])] + b[1:]),
    'page-name': mutate(['runePage', 'name'], 'Mine'),
    'page-current-1': mutate(['runePage', 'current'], 1),
    'page-current-false': mutate(['runePage', 'current'], False),
    'page-same-trees': mutate(['runePage', 'subStyleId'], base['runePage']['primaryStyleId']),
    'page-unknown-tree': mutate(['runePage', 'subStyleId'], 1234),
    'perks-8': mutate(['runePage', 'selectedPerkIds'], perks[:8]),
    'perks-negative': mutate(['runePage', 'selectedPerkIds'], [-1] + perks[1:]),
    'perk-wrong-primary-row': mutate(['runePage', 'selectedPerkIds'], [perks[1], perks[0]] + perks[2:]),
    'secondary-same-row': mutate(['runePage', 'selectedPerkIds'], perks[:4] + [perks[4], next(r for r in same_row if r != perks[4])] + perks[6:]),
    'secondary-from-primary': mutate(['runePage', 'selectedPerkIds'], perks[:4] + [primary['slots'][1]['runes'][0]['id'], primary['slots'][2]['runes'][0]['id']] + perks[6:]),
    'shard-wrong-row': mutate(['runePage', 'selectedPerkIds'], perks[:6] + [5011, perks[7], perks[8]]),
    'labels-extra-key': mutate(['labels', 'other'], {}),
    'labels-not-object': mutate(['labels', 'items'], []),
    'labels-301': mutate(['labels', 'items'], {str(n): 'x' for n in range(301)}),
    'labels-untrusted-text': mutate(['labels', 'items'], lambda items: {k: 'Free gold' for k in items}),
}


def outcome(run):
    try:
        result = run()
        return {'accept': True, 'uid': result['itemSet']['uid'], 'labels': result['labels']}
    except core.CompanionError as error:
        return {'accept': False, 'message': str(error)}


cases = [{'name': f'real-{b["championAlias"]}', 'bundle': b, **outcome(lambda b=b: core.validate_bundle(b, catalog))} for b in bases]
cases += [{'name': name, 'bundle': b, **outcome(lambda b=b: core.validate_bundle(b, catalog))} for name, b in mutations.items()]

raw = json.dumps(base).encode()
files = {
    'ok.riftbuild.json': raw,
    'download.riftbuild (2).json': raw,
    'bom.riftbuild.json': b'\xef\xbb\xbf' + raw,
    'wrong.json': raw,
    'zero.riftbuild (0).json': raw,
    'dup.riftbuild.json': b'{"version":1,"version":1}',
    'nan.riftbuild.json': b'{"version":NaN}',
    'broken.riftbuild.json': b'{"version":',
    'latin1.riftbuild.json': b'{"buildName":"\xe9"}',
    'large.riftbuild.json': b' ' * 65537,
}
file_cases = []
with tempfile.TemporaryDirectory() as tmp:
    for name, data in files.items():
        path = Path(tmp) / name
        path.write_bytes(data)
        result = outcome(lambda: {'itemSet': {'uid': None}, 'labels': None, 'value': core.load_input(str(path))})
        file_cases.append({'name': name, 'bytes': base64.b64encode(data).decode(), 'accept': result['accept'], **({'message': result['message']} if not result['accept'] else {})})

out = ROOT / 'tests/fixtures/bundle-parity.json'
out.write_text(json.dumps({'note': 'Generated by tests/fixtures/make_bundle_parity.py from companion.core. Do not edit by hand.', 'catalog': 'companion/catalog.json', 'cases': cases, 'files': file_cases}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(f'{len(cases)} bundle cases ({sum(c["accept"] for c in cases)} accepted), {len(file_cases)} file cases -> {out.relative_to(ROOT)}')
