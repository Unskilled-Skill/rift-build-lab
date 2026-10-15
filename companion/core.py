"""Validated bundle import and narrowly scoped League Client operations.

Only this module handles the client's in-memory credential. Errors deliberately
exclude upstream response bodies, URLs and exception text.
"""
import base64
import binascii
import copy
import hmac
import http.client
import json
import os
from pathlib import Path
import re
import ssl
import subprocess
import tempfile
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlsplit

MANAGED_NAME = 'Rift Build Lab'
MAX_INPUT = 65536
SAFE_PHASES = {'None', 'Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect'}


class CompanionError(Exception):
    """A safe, actionable message suitable for the local UI."""


class AmbiguousMutation(CompanionError):
    """A write may have reached the client; recovery must verify its state."""


def require(condition, message='Invalid build bundle.'):
    if not condition:
        raise CompanionError(message)


def strict_json(text):
    def pairs(values):
        result = {}
        for key, value in values:
            require(key not in result, 'Duplicate JSON fields are not accepted.')
            result[key] = value
        return result
    try:
        return json.loads(text, object_pairs_hook=pairs, parse_constant=lambda _: require(False))
    except (ValueError, TypeError, RecursionError):
        raise CompanionError('The import is not valid JSON.') from None


def load_input(source):
    try:
        if source.lower().startswith('riftbuildlab:'):
            require(len(source) <= 20000, 'The import link is too large. Use the build file instead.')
            uri = urlsplit(source)
            require(uri.scheme == 'riftbuildlab' and uri.netloc == 'import' and uri.path in ('', '/') and not uri.fragment)
            query = parse_qs(uri.query, strict_parsing=True)
            require(set(query) == {'data'} and len(query['data']) == 1)
            encoded = query['data'][0]
            require(re.fullmatch(r'[A-Za-z0-9_-]+', encoded) is not None)
            raw = base64.b64decode(encoded + '=' * (-len(encoded) % 4), altchars=b'-_', validate=True)
        else:
            path = Path(source)
            require(path.name.endswith('.riftbuild.json'), 'Choose a .riftbuild.json file.')
            require(path.stat().st_size <= MAX_INPUT, 'The build file is too large.')
            raw = path.read_bytes()
        require(len(raw) <= MAX_INPUT)
        return strict_json(raw.decode('utf-8-sig'))
    except CompanionError:
        raise
    except (OSError, ValueError, UnicodeError, binascii.Error):
        raise CompanionError('Could not read this build import.') from None


def keys(value, required, optional=()):
    require(isinstance(value, dict) and set(required) <= set(value) <= set(required) | set(optional))


def short_text(value, limit=120):
    require(isinstance(value, str) and 0 < len(value.strip()) <= limit and not any(ord(c) < 32 for c in value))


def integer(value, low=1, high=2147483647):
    require(type(value) is int and low <= value <= high)


def validate_bundle(bundle, catalog):
    keys(bundle, ['version', 'patch', 'dataVersion', 'championId', 'championAlias', 'buildName', 'itemSet', 'runePage', 'labels'])
    require(type(bundle['version']) is int and bundle['version'] == 1, 'Unsupported build format.')
    require(bundle['patch'] == catalog['patch'] and bundle['dataVersion'] == catalog['dataVersion'], 'This build uses a different data patch. Export it again from the current website.')
    integer(bundle['championId'])
    champion = next((c for c in catalog['champions'] if c['id'] == bundle['championId']), None)
    require(champion is not None and bundle['championAlias'] == champion['alias'], 'Champion ID and alias do not match the bundled catalog.')
    short_text(bundle['buildName'])
    item_set = bundle['itemSet']
    keys(item_set, ['title', 'associatedMaps', 'associatedChampions', 'map', 'mode', 'type', 'sortrank', 'blocks'], ['uid'])
    short_text(item_set['title'])
    require(item_set['title'].startswith(MANAGED_NAME))
    require(item_set['associatedMaps'] == [11] and all(type(v) is int for v in item_set['associatedMaps']) and item_set['associatedChampions'] == [bundle['championId']] and all(type(v) is int for v in item_set['associatedChampions']) and item_set['map'] == 'SR' and item_set['mode'] == 'any' and item_set['type'] == 'custom')
    integer(item_set['sortrank'], 0, 0)
    if 'uid' in item_set:
        try:
            uuid.UUID(item_set['uid'])
        except (ValueError, TypeError, AttributeError):
            raise CompanionError('Invalid item set identifier.') from None
    require(isinstance(item_set['blocks'], list) and 1 <= len(item_set['blocks']) <= 20)
    item_names = {str(i['id']): i['name'] for i in catalog['items']}
    for block in item_set['blocks']:
        keys(block, ['type', 'items'])
        short_text(block['type'], 80)
        require(isinstance(block['items'], list) and 1 <= len(block['items']) <= 30)
        for item in block['items']:
            keys(item, ['id', 'count'])
            require(isinstance(item['id'], str) and item['id'] in item_names, 'An item is absent from the bundled catalog.')
            integer(item['count'], 1, 9)
    page = bundle['runePage']
    keys(page, ['name', 'primaryStyleId', 'subStyleId', 'selectedPerkIds', 'current'])
    require(page['name'] == MANAGED_NAME and page['current'] is True)
    integer(page['primaryStyleId'])
    integer(page['subStyleId'])
    trees = {t['id']: t for t in catalog['trees']}
    require(page['primaryStyleId'] in trees and page['subStyleId'] in trees and page['primaryStyleId'] != page['subStyleId'], 'Choose two different legal rune trees.')
    perks = page['selectedPerkIds']
    require(isinstance(perks, list) and len(perks) == 9)
    for perk in perks:
        integer(perk)
    primary, secondary = trees[page['primaryStyleId']], trees[page['subStyleId']]
    require(all(perks[n] in {r['id'] for r in primary['slots'][n]['runes']} for n in range(4)), 'Primary runes must include one rune from each row.')
    secondary_rows = [{r['id'] for r in slot['runes']} for slot in secondary['slots'][1:]]
    rows = [next((n for n, row in enumerate(secondary_rows) if perk in row), None) for perk in perks[4:6]]
    require(None not in rows and rows[0] != rows[1], 'Secondary runes must come from two different minor rows.')
    require(all(perks[n + 6] in row for n, row in enumerate(catalog['shardRows'])), 'A stat shard is invalid for its row.')
    # Labels are untrusted presentation hints. Replace them with catalog names.
    keys(bundle['labels'], ['items', 'runes'])
    require(all(isinstance(v, dict) and len(v) <= 300 for v in bundle['labels'].values()))
    result = copy.deepcopy(bundle)
    result['itemSet']['uid'] = managed_uid(bundle['championId'])
    rune_names = {str(r['id']): r['name'] for tree in catalog['trees'] for slot in tree['slots'] for r in slot['runes']}
    rune_names.update({'5005': 'Attack speed', '5007': 'Ability haste', '5008': 'Adaptive force', '5010': 'Move speed', '5001': 'Scaling health', '5011': 'Health', '5013': 'Tenacity and slow resistance'})
    result['labels'] = {'items': {i['id']: item_names[i['id']] for block in item_set['blocks'] for i in block['items']}, 'runes': {str(p): rune_names.get(str(p), str(p)) for p in perks}}
    return result


def managed_uid(champion_id):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f'https://riftbuildlab.local/item-set/{champion_id}'))


@dataclass(repr=False)
class Credentials:
    port: int
    password: str = field(repr=False)

    def __repr__(self):
        return f'Credentials(port={self.port}, password=<redacted>)'


def parse_lockfile(text):
    fields = text.strip().split(':')
    require(len(fields) == 5, 'The League Client lockfile is invalid.')
    name, pid, port, password, protocol = fields
    require(name in ('LeagueClient', 'LeagueClientUx') and pid.isascii() and pid.isdigit() and int(pid) > 0 and port.isascii() and port.isdigit() and 1 <= int(port) <= 65535 and protocol == 'https' and re.fullmatch(r'[A-Za-z0-9_-]{1,256}', password) is not None, 'The League Client lockfile is invalid.')
    return Credentials(int(port), password)


def running_executable_paths():
    if os.name != 'nt':
        return []
    command = "Get-CimInstance Win32_Process -Filter \"Name='LeagueClient.exe' OR Name='LeagueClientUx.exe'\" | Select-Object -ExpandProperty ExecutablePath | ConvertTo-Json -Compress"
    try:
        process = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', command], capture_output=True, text=True, timeout=8, creationflags=subprocess.CREATE_NO_WINDOW)
        data = json.loads(process.stdout) if process.stdout.strip() else []
        return [data] if isinstance(data, str) else [v for v in data if isinstance(v, str)]
    except (OSError, ValueError, TypeError, subprocess.TimeoutExpired):
        return []


def discover_client(league_dir=None):
    directories = [Path(path).parent for path in running_executable_paths()]
    if league_dir:
        directories.append(Path(league_dir))
    directories.append(Path('C:/Riot Games/League of Legends'))
    for directory in dict.fromkeys(directories):
        try:
            file = directory / 'lockfile'
            if file.stat().st_size <= 2048:
                return parse_lockfile(file.read_text(encoding='utf-8'))
        except (OSError, UnicodeError, CompanionError):
            continue
    raise CompanionError('League Client is not available. Open League of Legends, sign in, then retry. If needed, set its install folder with --league-dir.')


class LCUClient:
    def __init__(self, credentials, ca_path):
        self._credentials = credentials
        try:
            self._context = ssl.create_default_context(cafile=str(ca_path))
            # Riot's local certificate uses a fixed name; chain validation remains required.
            self._context.check_hostname = False
            self._context.verify_mode = ssl.CERT_REQUIRED
        except (OSError, ssl.SSLError):
            raise CompanionError('The bundled Riot certificate is missing or invalid. Reinstall the companion.') from None

    def request(self, method, path, data=None):
        allowed = (method == 'GET' and path in {'/lol-summoner/v1/current-summoner', '/lol-gameflow/v1/gameflow-phase', '/lol-patch/v1/game-version', '/lol-perks/v1/pages'}) or (method in {'GET', 'PUT'} and re.fullmatch(r'/lol-item-sets/v1/item-sets/[1-9][0-9]*/sets', path)) or (method == 'POST' and path == '/lol-perks/v1/pages') or (method in {'PUT', 'DELETE'} and re.fullmatch(r'/lol-perks/v1/pages/[1-9][0-9]*', path))
        require(allowed, 'This client operation is not permitted.')
        connection = http.client.HTTPSConnection('127.0.0.1', self._credentials.port, context=self._context, timeout=8)
        try:
            auth = base64.b64encode(('riot:' + self._credentials.password).encode()).decode()
            body = json.dumps(data).encode() if data is not None else None
            connection.request(method, path, body=body, headers={'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json', 'Accept': 'application/json'})
            response = connection.getresponse()
            raw = response.read(4 * 1024 * 1024 + 1)
            if len(raw) > 4 * 1024 * 1024:
                error_type = AmbiguousMutation if method != 'GET' else CompanionError
                raise error_type('The client returned an unexpectedly large response. Check League Client before retrying.')
            if not 200 <= response.status < 300:
                if method == 'POST' and path == '/lol-perks/v1/pages' and response.status < 500:
                    raise CompanionError('The client rejected the rune page. Free a rune page slot and retry; no existing pages were deleted.')
                error_type = AmbiguousMutation if method != 'GET' and response.status >= 500 else CompanionError
                raise error_type(f'The League Client rejected an operation (HTTP {response.status}). Retry once the client is ready.')
            try:
                return strict_json(raw.decode()) if raw else None
            except (CompanionError, UnicodeError):
                error_type = AmbiguousMutation if method != 'GET' else CompanionError
                raise error_type('The client returned an unsupported response. Check League Client before retrying.') from None
        except CompanionError:
            raise
        except (OSError, http.client.HTTPException, UnicodeError):
            error_type = AmbiguousMutation if method != 'GET' else CompanionError
            raise error_type('Could not securely communicate with League Client. Check that it is running and retry.') from None
        finally:
            connection.close()


def major_minor(version):
    match = re.match(r'^(\d+)\.(\d+)(?:\.|$)', version) if isinstance(version, str) else None
    require(match is not None, 'The client game version could not be checked.')
    return tuple(int(v) for v in match.groups())


def check_ready(client, bundle):
    phase = client.request('GET', '/lol-gameflow/v1/gameflow-phase')
    require(isinstance(phase, str) and phase in SAFE_PHASES, 'Apply is unavailable during a game, reconnect, or an unknown client state. Return to the League lobby and retry.')
    version = client.request('GET', '/lol-patch/v1/game-version')
    require(major_minor(version) == major_minor(bundle['dataVersion']), 'Client and build patches differ. Update League and export this build again before applying.')
    return phase


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def rune_payload(page):
    return {key: copy.deepcopy(page[key]) for key in ['name', 'primaryStyleId', 'subStyleId', 'selectedPerkIds', 'current']}


def apply_bundle(client, bundle, catalog, backup_dir, items=True, runes=True):
    require(type(items) is bool and type(runes) is bool and (items or runes), 'Select items, runes, or both.')
    bundle = validate_bundle(bundle, catalog)
    check_ready(client, bundle)
    summoner = client.request('GET', '/lol-summoner/v1/current-summoner')
    require(isinstance(summoner, dict), 'Sign in to League Client before applying.')
    summoner_id = summoner.get('summonerId')
    integer(summoner_id, 1, 2**64 - 1)
    item_path = f'/lol-item-sets/v1/item-sets/{summoner_id}/sets'
    original_sets = client.request('GET', item_path) if items else None
    pages = client.request('GET', '/lol-perks/v1/pages') if runes else []
    require(isinstance(pages, list) and all(isinstance(p, dict) for p in pages), 'The client returned an unsupported rune page format.')
    owned = [p for p in pages if p.get('name') == MANAGED_NAME and p.get('isEditable') is True]
    require(len(owned) <= 1, 'Multiple editable Rift Build Lab rune pages exist. Rename extras in League Client before retrying.')
    owned = owned[0] if owned else None
    if owned:
        integer(owned.get('id'))
        try:
            old_rune = rune_payload(owned)
        except KeyError:
            raise CompanionError('The managed rune page has an unsupported client format.') from None
    if items:
        require(isinstance(original_sets, dict) and isinstance(original_sets.get('itemSets'), list) and all(isinstance(s, dict) for s in original_sets['itemSets']), 'The client returned an unsupported item set format.')
        new_sets = copy.deepcopy(original_sets)
        new_sets['itemSets'] = [s for s in new_sets['itemSets'] if s.get('uid') != bundle['itemSet']['uid']] + [bundle['itemSet']]
    backup_path = Path(backup_dir) / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex + '.json')
    try:
        atomic_json(backup_path, {'format': 1, 'createdAt': datetime.now(timezone.utc).isoformat(), 'summonerId': summoner_id, 'itemSets': original_sets, 'runePages': pages, 'bundle': bundle})
    except OSError:
        raise CompanionError('Could not save a local backup. Nothing was applied. Check disk space and folder permissions.') from None
    # Recheck immediately before writes; preview state is never treated as authority.
    check_ready(client, bundle)
    items_attempted = False
    items_completed = False
    runes_attempted = False
    try:
        if items:
            items_attempted = True
            client.request('PUT', item_path, new_sets)
            items_completed = True
        if runes:
            check_ready(client, bundle)
            runes_attempted = True
            if owned:
                client.request('PUT', f"/lol-perks/v1/pages/{owned['id']}", bundle['runePage'])
            else:
                client.request('POST', '/lol-perks/v1/pages', bundle['runePage'])
    except CompanionError as error:
        failures = []
        if runes_attempted and isinstance(error, AmbiguousMutation):
            try:
                if owned:
                    client.request('PUT', f"/lol-perks/v1/pages/{owned['id']}", old_rune)
                else:
                    # An uncertain POST has no definitive ID. Never infer ownership
                    # from a name or delete a page based on a coincidental match.
                    failures.append('runes (creation result unknown)')
            except (CompanionError, KeyError, TypeError):
                failures.append('runes')
        if items_attempted and (items_completed or isinstance(error, AmbiguousMutation)):
            try:
                client.request('PUT', item_path, original_sets)
            except CompanionError:
                failures.append('items')
        if failures:
            raise CompanionError('PARTIAL APPLY: automatic recovery could not restore ' + ' and '.join(failures) + '. Check League Client before retrying. Your backup is saved locally.') from None
        recovery = ' Previous settings were restored; no unrelated pages were deleted.' if items_completed or isinstance(error, AmbiguousMutation) else ' No settings were changed.'
        raise CompanionError(str(error) + recovery) from None
    return {'message': 'Applied to League Client. Your previous settings were backed up locally.', 'backup': str(backup_path)}


def authorized_request(host, origin, token, port, expected_token):
    return host == f'127.0.0.1:{port}' and origin == f'http://127.0.0.1:{port}' and isinstance(token, str) and hmac.compare_digest(token, expected_token)
