# Four builds per champion

The user replaced the DeepSeek integration request with authoring four full builds for every champion, one by one. No provider/key configuration is part of this change.

Use the existing patch 26.20 champion/item/rune snapshot. For each of 173 champions, prepare four distinct six-item proposals: a reference, a damage interaction, a situational adaptation and a higher-risk experiment. Include complete legal rune pages, shards, specific kit reasoning, purchase priorities, comparison tests, failure conditions and calculator limitations. These are hypotheses, not verified recommendations or mathematical optima.

Keep earlier authored experiments available separately. Store each champion's four proposals in a separate file and load only the selected champion. This avoids expanding the existing 100-proposal parser limit or downloading every detailed test plan at once.

Work through the roster in catalog order, reading each champion's kit/profile. Curated item packages can be reused where appropriate; per-champion choices and reasoning must be explicit. Record source-formula evidence and do not infer that spells apply on-hit effects without a confirmed mechanic. Check unique item families, correct map variants and complete rune rows. Full six-item plans must also describe the early core and matchup-dependent purchases.

Verification: manifest covers the exact roster; each champion file has exactly four distinct proposals for that champion; all proposals pass shared item/rune/scenario validation; earlier experiment file remains intact; browser loads multiple champion collections and the manual test sheet; tests/build pass.
