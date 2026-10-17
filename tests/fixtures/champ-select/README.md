# Champ-select session fixtures

Hand-written from the community-documented shape of `GET /lol-champ-select/v1/session`
(`gameId`, `localPlayerCellId`, `myTeam[].{cellId, championId, championPickIntent, assignedPosition}`,
`actions[][].{actorCellId, championId, completed, type}`). **Provisional:** replace or extend them
with payloads captured from a signed-in client during the live verification (plan T23).
Only the fields the reducer reads matter; other fields are ignored.
