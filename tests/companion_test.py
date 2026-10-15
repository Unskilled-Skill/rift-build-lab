import base64
import copy
import json
import ssl
import tempfile
import threading
import urllib.error
import urllib.request
import unittest
from pathlib import Path
from unittest.mock import patch

from companion import core
from companion import app


def fixture():
    catalog = {'patch': '26.20', 'dataVersion': '16.20.1',
        'champions': [{'id': 69, 'alias': 'Cassiopeia', 'name': 'Cassiopeia'}],
        'items': [{'id': 1056, 'name': "Doran's Ring"}],
        'trees': [{'id': 8200, 'name': 'Sorcery', 'slots': [{'runes': [{'id': n, 'name': str(n)}]} for n in [8214, 8226, 8210, 8237]]},
                  {'id': 8000, 'name': 'Precision', 'slots': [{'runes': [{'id': n, 'name': str(n)}]} for n in [8005, 8009, 9104, 8014]]}],
        'shardRows': [[5005, 5007, 5008], [5008, 5010, 5001], [5011, 5013, 5001]]}
    bundle = {'version': 1, 'patch': '26.20', 'dataVersion': '16.20.1', 'championId': 69,
        'championAlias': 'Cassiopeia', 'buildName': 'Test build',
        'itemSet': {'title': 'Rift Build Lab Cassiopeia', 'associatedMaps': [11], 'associatedChampions': [69], 'map': 'SR', 'mode': 'any', 'type': 'custom', 'sortrank': 0,
                    'blocks': [{'type': 'Starting items', 'items': [{'id': '1056', 'count': 1}]}]},
        'runePage': {'name': 'Rift Build Lab', 'primaryStyleId': 8200, 'subStyleId': 8000, 'selectedPerkIds': [8214, 8226, 8210, 8237, 8009, 8014, 5008, 5008, 5001], 'current': True},
        'labels': {'items': {'1056': 'Untrusted label'}, 'runes': {}}}
    return catalog, bundle


class FakeLCU:
    def __init__(self):
        self.phase = 'Lobby'
        self.version = '16.20.123.456'
        self.sets = {'accountId': 12, 'timestamp': 10, 'itemSets': [{'uid': 'personal', 'title': 'Keep me', 'blocks': []}]}
        self.pages = [{'id': 12, 'name': 'Rift Build Lab', 'isEditable': True, 'current': False, 'primaryStyleId': 8000, 'subStyleId': 8200, 'selectedPerkIds': [1]}]
        self.fail_runes = False
        self.fail_rollback = False
        self.writes = []

    def request(self, method, path, data=None):
        if method == 'GET':
            return copy.deepcopy({'/lol-summoner/v1/current-summoner': {'summonerId': 42}, '/lol-gameflow/v1/gameflow-phase': self.phase,
                '/lol-patch/v1/game-version': self.version, '/lol-perks/v1/pages': self.pages,
                '/lol-item-sets/v1/item-sets/42/sets': self.sets}[path])
        self.writes.append((method, path, copy.deepcopy(data)))
        if '/lol-perks/' in path and self.fail_runes:
            raise core.CompanionError('Client rejected rune page; free a slot and retry.')
        if '/lol-item-sets/' in path:
            if self.fail_rollback and len(self.writes) > 1:
                raise core.CompanionError('Client unavailable.')
            self.sets = copy.deepcopy(data)
        elif method == 'PUT':
            self.pages = [dict(data, id=12, isEditable=True)]
        elif method == 'POST':
            self.pages.append(dict(data, id=99, isEditable=True))
            return {'id': 99}
        return None


class CompanionTests(unittest.TestCase):
    def setUp(self):
        self.catalog, self.bundle = fixture()
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def test_validates_and_derives_names_instead_of_trusting_labels(self):
        result = core.validate_bundle(self.bundle, self.catalog)
        self.assertEqual(result['labels']['items']['1056'], "Doran's Ring")

    def test_rejects_invalid_champion_items_rows_and_unknown_fields(self):
        for mutate in [lambda b: b.update(championAlias='Annie'), lambda b: b['itemSet']['blocks'][0]['items'][0].update(id='999999'),
                       lambda b: b['runePage']['selectedPerkIds'].__setitem__(0, 8009), lambda b: b['runePage']['selectedPerkIds'].__setitem__(5, 8009),
                       lambda b: b['itemSet'].update(associatedMaps=[12]), lambda b: b.update(endpoint='https://evil.test'),
                       lambda b: b['itemSet']['blocks'][0]['items'][0].update(count=True), lambda b: b['runePage']['selectedPerkIds'].__setitem__(8, 5005)]:
            with self.subTest(mutate=mutate):
                value = copy.deepcopy(self.bundle)
                mutate(value)
                with self.assertRaises(core.CompanionError): core.validate_bundle(value, self.catalog)

    def test_protocol_and_file_limit(self):
        raw = json.dumps(self.bundle).encode()
        uri = 'riftbuildlab://import?data=' + base64.urlsafe_b64encode(raw).decode().rstrip('=')
        self.assertEqual(core.load_input(uri)['championId'], 69)
        with self.assertRaises(core.CompanionError): core.load_input(uri + '&path=x')
        with self.assertRaises(core.CompanionError): core.load_input('riftbuildlab://import?data=' + 'A' * 20000)

    def test_lockfile_never_exposes_password(self):
        credentials = core.parse_lockfile('LeagueClient:1234:54321:VERY_SECRET:https')
        self.assertNotIn('VERY_SECRET', str(credentials))
        self.assertNotIn('VERY_SECRET', repr(credentials))
        for text in ['LeagueClient:123:0:SECRET:https', 'LeagueClient:123:123:SECRET:http', 'wrong:123:123:SECRET:https']:
            with self.assertRaises(core.CompanionError) as error: core.parse_lockfile(text)
            self.assertNotIn('SECRET', str(error.exception))

    def test_transport_verifies_tls_rejects_external_paths_and_redacts_errors(self):
        client = core.LCUClient(core.Credentials(54321, 'VERY_SECRET'), Path('companion/riotgames.pem'))
        self.assertEqual(client._context.verify_mode, ssl.CERT_REQUIRED)
        with self.assertRaises(core.CompanionError): client.request('POST', 'https://evil.test/')
        with patch.object(core.http.client.HTTPSConnection, 'request', side_effect=OSError('VERY_SECRET')):
            with self.assertRaises(core.CompanionError) as error: client.request('GET', '/lol-perks/v1/pages')
        self.assertNotIn('VERY_SECRET', str(error.exception))

    def test_discovery_uses_executable_directory_then_configured_directory(self):
        root = Path(self.tmp.name)
        (root / 'lockfile').write_text('LeagueClient:123:12345:password:https')
        with patch.object(core, 'running_executable_paths', return_value=[str(root / 'LeagueClientUx.exe')]):
            self.assertEqual(core.discover_client(None).port, 12345)
        with patch.object(core, 'running_executable_paths', return_value=[]):
            self.assertEqual(core.discover_client(str(root)).port, 12345)

    def test_host_origin_and_token_are_all_required(self):
        self.assertTrue(core.authorized_request('127.0.0.1:9000', 'http://127.0.0.1:9000', 'abc', 9000, 'abc'))
        for host, origin, token in [('localhost:9000', 'http://127.0.0.1:9000', 'abc'), ('127.0.0.1:9000', None, 'abc'), ('127.0.0.1:9000', 'https://evil.test', 'abc'), ('127.0.0.1:9000', 'http://127.0.0.1:9000', 'bad')]:
            self.assertFalse(core.authorized_request(host, origin, token, 9000, 'abc'))

    def test_patch_and_unsafe_phases_fail_before_any_write(self):
        for phase, version in [('InProgress', '16.20.1'), ('Reconnect', '16.20.1'), ('Unknown', '16.20.1'), ('Lobby', '16.19.1')]:
            client = FakeLCU()
            client.phase, client.version = phase, version
            with self.assertRaises(core.CompanionError): core.apply_bundle(client, self.bundle, self.catalog, Path(self.tmp.name), True, True)
            self.assertEqual(client.writes, [])

    def test_preserves_unrelated_sets_updates_only_owned_page_and_backs_up(self):
        client = FakeLCU()
        core.apply_bundle(client, self.bundle, self.catalog, Path(self.tmp.name), True, True)
        self.assertEqual(client.sets['itemSets'][0]['uid'], 'personal')
        self.assertEqual(client.sets['itemSets'][1]['uid'], core.managed_uid(69))
        self.assertEqual(client.writes[1][0:2], ('PUT', '/lol-perks/v1/pages/12'))
        self.assertTrue(list(Path(self.tmp.name).glob('*.json')))
        core.apply_bundle(client, self.bundle, self.catalog, Path(self.tmp.name), True, False)
        self.assertEqual(len(client.sets['itemSets']), 2)

    def test_full_rune_capacity_never_deletes_any_page(self):
        client = FakeLCU()
        client.pages[0]['name'] = 'Personal page'
        client.fail_runes = True
        with self.assertRaises(core.CompanionError): core.apply_bundle(client, self.bundle, self.catalog, Path(self.tmp.name), False, True)
        self.assertEqual(client.pages[0]['name'], 'Personal page')
        self.assertEqual([m for m, _, _ in client.writes], ['POST'])

    def test_second_step_failure_rolls_back_items(self):
        client = FakeLCU()
        original = copy.deepcopy(client.sets)
        client.fail_runes = True
        with self.assertRaisesRegex(core.CompanionError, 'restored'): core.apply_bundle(client, self.bundle, self.catalog, Path(self.tmp.name), True, True)
        self.assertEqual(client.sets, original)

    def test_rejected_first_write_reports_rejection_without_unnecessary_rollback(self):
        client = FakeLCU()
        original_request = client.request
        writes = []
        def reject(method, path, data=None):
            if method != 'GET':
                writes.append(path)
                raise core.CompanionError('Write rejected.')
            return original_request(method, path, data)
        client.request = reject
        with self.assertRaisesRegex(core.CompanionError, 'Write rejected'):
            core.apply_bundle(client, self.bundle, self.catalog, Path(self.tmp.name), True, True)
        self.assertEqual(len(writes), 1)

    def test_rollback_failure_is_reported_as_partial(self):
        client = FakeLCU()
        client.fail_runes = client.fail_rollback = True
        with self.assertRaisesRegex(core.CompanionError, 'PARTIAL'): core.apply_bundle(client, self.bundle, self.catalog, Path(self.tmp.name), True, True)

    def test_ambiguous_page_creation_reports_partial_without_deletion(self):
        client = FakeLCU()
        client.pages = []
        original_request = client.request
        def uncertain(method, path, data=None):
            if method == 'POST':
                original_request(method, path, data)
                raise core.AmbiguousMutation('Connection interrupted.')
            return original_request(method, path, data)
        client.request = uncertain
        with self.assertRaisesRegex(core.CompanionError, 'PARTIAL'): core.apply_bundle(client, self.bundle, self.catalog, Path(self.tmp.name), True, True)
        self.assertFalse(any(method == 'DELETE' for method, _, _ in client.writes))

    def test_http_preview_requires_origin_and_token_and_never_applies_on_load(self):
        client = FakeLCU()
        server = app.make_server(None, self.catalog, Path(self.tmp.name), client_factory=lambda: client)
        self.addCleanup(server.server_close)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.shutdown)
        origin = f'http://127.0.0.1:{server.server_port}'
        def post(path, body, token=None, request_origin=origin):
            headers = {'Content-Type': 'application/json', 'Origin': request_origin}
            if token: headers['X-Rift-Token'] = token
            return urllib.request.urlopen(urllib.request.Request(origin + path, json.dumps(body).encode(), headers=headers), timeout=3)
        with self.assertRaises(urllib.error.HTTPError) as error: post('/load', {'bundle': self.bundle})
        self.assertEqual(error.exception.code, 403)
        with self.assertRaises(urllib.error.HTTPError): post('/load', {'bundle': self.bundle}, server.token, 'https://evil.test')
        response = json.load(post('/load', {'bundle': self.bundle}, server.token))
        self.assertEqual(response['bundle']['championAlias'], 'Cassiopeia')
        self.assertEqual(client.writes, [])
        self.assertTrue(json.load(post('/status', {}, server.token))['ready'])
        self.assertEqual(client.writes, [])
        self.assertTrue(json.load(post('/apply', {'items': True, 'runes': False}, server.token))['ok'])



class DuplicateDownloadNameTests(unittest.TestCase):
 def test_loads_browser_renamed_build_files_after_repeat_downloads(self):
  with tempfile.TemporaryDirectory() as directory:
   for name in ['example.riftbuild.json','example.riftbuild (1).json','example.riftbuild (12).json']:
    path=Path(directory)/name
    path.write_text(json.dumps({'version':1}),encoding='utf-8')
    with self.subTest(name=name):self.assertEqual(core.load_input(str(path)),{'version':1})

if __name__ == '__main__': unittest.main()
