use std::path::PathBuf;

use rbl_core::lcu::champ_select::{SessionView, position_role, reduce};
use rbl_core::prefs::Role;
use serde_json::{Value, json};

fn fixture(name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/champ-select").join(format!("{name}.json"));
    serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
}

#[test]
fn reports_only_the_local_players_locked_champion_and_assigned_role() {
    let cases = [
        ("draft-hovering", 7300000001, None, Some(Role::Mid)),
        ("draft-hover-shown-as-champion", 7300000001, None, Some(Role::Mid)),
        ("draft-locked", 7300000001, Some(103), Some(Role::Mid)),
        ("draft-locked-support", 7300000002, Some(412), Some(Role::Support)),
        ("blind-locked", 7300000003, Some(69), None),
        ("aram-assigned", 7300000004, Some(22), None),
        ("aram-swapped", 7300000004, Some(51), None),
        ("custom-game-id-zero", 0, Some(69), None),
        ("spectating-no-local-cell", 7300000005, None, None),
    ];
    for (name, game_id, champion_id, role) in cases {
        assert_eq!(reduce(&fixture(name)), Some(SessionView { game_id, champion_id, role }), "{name}");
    }
}

#[test]
fn ignores_teammates_and_malformed_sessions() {
    let teammate_locked = json!({"gameId": 1, "localPlayerCellId": 2,
        "myTeam": [{"cellId": 1, "championId": 99}, {"cellId": 2, "championId": 0}],
        "actions": [[{"actorCellId": 1, "championId": 99, "completed": true, "type": "pick"}]]});
    assert_eq!(reduce(&teammate_locked).unwrap().champion_id, None);
    for bad in [
        json!(null),
        json!([]),
        json!({"myTeam": []}),
        json!({"localPlayerCellId": "2", "myTeam": []}),
        json!({"localPlayerCellId": 2, "myTeam": "x"}),
    ] {
        assert_eq!(reduce(&bad), None, "{bad}");
    }
    let negative = json!({"gameId": 1, "localPlayerCellId": 2, "myTeam": [{"cellId": 2, "championId": -5}], "actions": []});
    assert_eq!(reduce(&negative).unwrap().champion_id, None);
}

#[test]
fn maps_client_positions_to_build_roles() {
    for (position, role) in [
        ("top", Some(Role::Top)),
        ("jungle", Some(Role::Jungle)),
        ("middle", Some(Role::Mid)),
        ("bottom", Some(Role::Adc)),
        ("utility", Some(Role::Support)),
        ("UTILITY", Some(Role::Support)),
        ("", None),
        ("fill", None),
        ("mid", None),
    ] {
        assert_eq!(position_role(position), role, "{position}");
    }
}
