# Rift Build Lab Windows companion

Optional personal companion for importing the website's items + runes bundle into an open League Client. Opening a link or file only opens a local preview. Review it and click **Apply to League Client** to write. Items and runes can be selected separately.

## Personal setup and test

Use the packaged Windows download and its included installer, or run from source with Python 3.13 (standard library only):

```powershell
python companion/app.py
python companion/app.py "C:\Downloads\cassiopeia.riftbuild.json"
python companion/app.py --league-dir "D:\Games\League of Legends"
```

With no build argument, use **Load a build file** in the browser preview. Download the **items + runes file** from the website; a standard League item-set JSON file alone has no rune page and is not this format. The custom protocol accepts `riftbuildlab://import?data=<base64url UTF-8 JSON>`; links are limited to 20,000 characters. Files are limited to 64 KB.

Open League of Legends and sign in. Review the preview, click **Retry client check**, select items/runes and click **Apply**. Verify the named rune page and champion item set inside League before playing. An unrelated named personal rune page and unrelated item sets should remain. Try a second build for the same champion: it should replace the managed item set, not append another. If rune capacity is full, free a slot yourself and retry; the companion never deletes personal pages to create room.

When League is closed, preview still works and Apply stays disabled. Patches must match, and game/reconnect/unknown states block apply. Discovery checks executable directories of running `LeagueClient.exe`/`LeagueClientUx.exe`, the configured install folder, then `C:\Riot Games\League of Legends`. `--league-dir` saves only that folder in `%LOCALAPPDATA%\RiftBuildLab\settings.json`.

Close the preview with **Close companion**, or it exits after 15 minutes without activity. A browser tab left open after exit cannot reconnect without reopening the companion.

## Backups and recovery

Every apply creates an atomic JSON backup under `%LOCALAPPDATA%\RiftBuildLab\backups` before any mutation. Backups include item sets, rune pages and the selected build; they do not contain the League authentication password. Treat them as personal account configuration. Backups are retained for manual recovery; the companion does not silently expire or upload them.

One item set is managed per champion using a deterministic UUID, and one editable rune page is managed under the exact name **Rift Build Lab**. If the second write fails, the companion attempts to restore the original item sets. An uncertain existing rune-page update also attempts restoration. An uncertain new-page creation has no definitive ID and is reported as **PARTIAL APPLY**; it never guesses ownership or deletes a matching page. Check the League Client and the backup before retrying after a partial result. The client offers no transaction primitive, so rollback can also fail if it disconnects.

## Local security

The preview binds only `127.0.0.1` on an ephemeral port, uses a random session token in the initial URL fragment, accepts no CORS requests, and checks Host, Origin and token on every POST. There are no payload-selected endpoints or executable paths. Names are derived from a bundled patch catalog and inserted into the page as text. LCU requests target `127.0.0.1` only and require a certificate chain verified against the bundled Riot CA; hostname checking alone is disabled for the local Riot certificate. There is no insecure TLS fallback. Credentials remain in memory and are excluded from logs, errors and backups.

For browser QA without opening a tab automatically:

```powershell
python companion/app.py --no-browser --port 49173
python -m unittest discover -s tests -p companion_test.py
```

The printed local URL includes the preview session token, never the League Client password. There is no fake-client runtime mode. Automated tests use an isolated mock client at the transport boundary and exercise real local HTTP protection.

## Compatibility and distribution

**Live League Client apply has not been verified in this development environment because League Client was not running.** Automated tests cover validation, discovery, credential redaction, TLS enforcement, phase/patch blocking, local request protection, managed updates, capacity rejection and rollback. A signed-in personal client test remains required before relying on this for play.

League Client API is an unsupported interface that can change without notice. Riot says developers must register their product and disclose League Client API usage: [Riot League Client API guidance](https://developer.riotgames.com/docs/lol#league-client-api). This project is not Riot approved or endorsed. Public distribution requires the owner's Riot product registration and policy review; local tests or a packaged executable do not constitute approval.

Endpoint contracts were checked against the maintainer's extracted client API artifacts: [KebsCS LCU API repository](https://github.com/KebsCS/lcu-and-riotclient-api), [item set and perk endpoint documentation](https://lcu.kebs.dev/). Item-set GET/PUT uses the `{accountId, timestamp, itemSets}` envelope. Rune-page GET is a list; POST creates a page, and PUT updates a known editable page ID.

## Packaged Windows setup

Extract every ZIP entry into one folder and run **Install.cmd** once. This copies only the companion EXE to `%LOCALAPPDATA%\RiftBuildLab\Companion` and registers the `riftbuildlab://` link handler for your Windows user, without administrator privileges. It refuses to replace a link handler owned by another application. Run **Uninstall.cmd** to remove that handler; local backups remain.

The EXE is an unsigned personal-test build. Only run a copy you trust. The website also publishes `companion-manifest.json` and a `.zip.sha256` file to identify the packaged download. Do not disable security protections to run it. You can instead use the reviewed Python source.

To rebuild on Windows after companion code or patch-data changes:

```powershell
python -m pip install -r companion/requirements-build.txt
node scripts/prepare-companion-data.mjs
npm test
python scripts/package-companion.py
python -m unittest discover -s tests -p '*test.py'
```

The bundled Riot CA is downloaded from `https://static.developer.riotgames.com/docs/lol/riotgames.pem`; SHA-256: `da884275737f024b33c93ae5d28bdb002768a3cb73752ab40254a32218193521`. A new patch requires rebuilding the companion; old companion builds reject newer website bundles. The public data refresh does not silently replace the installed EXE.
