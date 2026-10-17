//! Reduces `GET /lol-champ-select/v1/session` to what automatic imports may act on: the local
//! player's *locked* champion and assigned role. Teammates, bans and hover intent are ignored.

use serde_json::Value;

use crate::prefs::Role;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SessionView {
    /// 0 in custom games; combined with an entry counter to identify a selection session.
    pub game_id: u64,
    /// Locked (or, without pick actions such as ARAM, assigned) champion; `None` while hovering.
    pub champion_id: Option<i64>,
    /// `None` for blind pick, ARAM, customs and unknown positions.
    pub role: Option<Role>,
}

/// League's `assignedPosition` values.
pub fn position_role(position: &str) -> Option<Role> {
    match position.to_ascii_lowercase().as_str() {
        "top" => Some(Role::Top),
        "jungle" => Some(Role::Jungle),
        "middle" => Some(Role::Mid),
        "bottom" => Some(Role::Adc),
        "utility" => Some(Role::Support),
        _ => None,
    }
}

pub fn reduce(session: &Value) -> Option<SessionView> {
    let cell = session.get("localPlayerCellId")?.as_i64()?;
    let team = session.get("myTeam")?.as_array()?;
    let game_id = session.get("gameId").and_then(Value::as_u64).unwrap_or(0);
    let me = team.iter().find(|p| p.get("cellId").and_then(Value::as_i64) == Some(cell));
    let role = me.and_then(|p| p.get("assignedPosition")).and_then(Value::as_str).and_then(position_role);
    let picks: Vec<&Value> = session
        .get("actions")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_array)
        .flatten()
        .filter(|a| a.get("type").and_then(Value::as_str) == Some("pick") && a.get("actorCellId").and_then(Value::as_i64) == Some(cell))
        .collect();
    let champion = if picks.is_empty() {
        // No pick turn (ARAM, some customs): the assigned champion is final until a bench swap.
        me.and_then(|p| p.get("championId")).and_then(Value::as_i64)
    } else {
        picks
            .iter()
            .rev()
            .find(|a| a.get("completed") == Some(&Value::Bool(true)))
            .and_then(|a| a.get("championId"))
            .and_then(Value::as_i64)
    };
    Some(SessionView { game_id, champion_id: champion.filter(|id| *id > 0), role })
}
