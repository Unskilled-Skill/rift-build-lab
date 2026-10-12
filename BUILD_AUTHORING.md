# Kit-first build authoring

The desired output is an individually reasoned champion experiment, not a renamed role recipe. Four proposals are retained per champion, with distinct objectives. Start with a practical reference, a narrow damage objective, a matchup/access or repeated-action objective, and an unusual kit interaction. Category is not a constraint on damage type or items.

For each route:

1. Read every primary ability and passive from the stored patch source. Identify damage types, total/bonus stat ratios, resource conversions, attack resets, charges, pet scaling, proc eligibility and timing.
2. Define what is maximized: one E attack, a complete charged attack, three-stack detonation, delivered damage over ten seconds, shields, healing, completed picks, or repeated CC. Different objectives need different builds.
3. Explain the contribution of each item and rune. Armor penetration cannot amplify a magic packet; crit cannot multiply an arbitrary passive; an extra item on-hit is not another ability cast, pet hit or champion stack.
4. Keep conditions finite and attainable: ranks, earned souls, resource state, game time, item transformation, target defenses, charge, stack counts and buffs. Separate first-hit, expected and sustained damage.
5. Compare a two-item checkpoint and late six slots at matched gold. Record access, misses, mana, survival and ally utility. Do not call a stationary-target maximum a practical winning build.
6. State a concrete falsification. Mark doubtful ideas low-confidence and make it easy for a test to reject them. Novel to this library is not historically new or proven strong.
7. Save complete authored collections in `scripts/champion-build-overrides/{alias}.json`, then regenerate and validate. Assign new IDs when a route changes meaning so earlier tests remain correctly identified.

Completed deeper collections: Blitzcrank, Thresh, Warwick, Jax, Varus, Malzahar and Leona (28 proposals). Other champions remain first-pass shared candidate packages; do not present them as already individually revised.

No live AI provider or complete damage solver exists. These authoring instructions support this conversation's local workflow. Numerical adapters remain Cassiopeia Q/E and Sett W.
