# Rift Build Lab
Browser application for a League player exploring damage tradeoffs and unusual kit-based builds. Data collected for 26.20 / 16.20.1. All 173 champions and AI-authored hypotheses are browsable. Cassiopeia Q/E and Sett W are the initial numerical adapters. Hypotheses are not validated gameplay recommendations. Runtime AI generation is not available in this release.

User instructed us to proceed with the app. Inferred preferences: local-first, no accounts or API key, repeatable calculations, explicit coverage, keyboard-accessible desktop tool with mobile support.

The user chose this existing ChatGPT conversation as the build authoring workflow. The app prepares a local request, and the assistant writes complete proposals into the workspace inbox when asked here. The app loads the proposals for calculation and manual game tests, retaining observations for the next revision. It cannot independently invoke or message this conversation. The first inbox contains three Cassiopeia and three Sett experiments.
