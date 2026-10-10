# Chat-authored builds and test workflow

User wants this chat to author builds and put them into the app for testing, with no API-key setup. The app cannot call this conversation. A local request endpoint stores the user's chosen champion, goal and scenario in `data/requests/latest-build-request.json`; the user can tell this chat to read it. This chat writes versioned builds into `public/data/chatgpt-builds.json`. The UI refreshes the inbox and validates references before exposing a Load & test action.

Implementation: write build-payload and request-validation fixtures first; implement strict current-patch full-build/rune validation, a same-origin local Vite endpoint, a ChatGPT builds screen, and an in-game test sheet with local results. Supply six freshly authored Cassiopeia/Sett hypotheses. Keep numeric coverage limits intact. Verify main flows, build and tests. Provider work is deferred: the user's follow-up chose this chat as the AI author.

Acceptance: requests survive locally; authored builds arrive without an API key; full item/rune page loads into the lab; all champions can record in-game tests even without numerical adapters; invalid builds and mismatched patches are rejected; test notes persist and export. Generated hypotheses are never labelled proven OP.
