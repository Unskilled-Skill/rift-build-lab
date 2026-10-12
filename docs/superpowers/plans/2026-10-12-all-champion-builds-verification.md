# Collection verification

- The collection has exactly 173 champion files and 692 proposals. Every champion's four item sets differ, and all IDs are unique.
- Shared parser verifies source item/map/family references, complete legal rune pages, shards and bounded loadable scenarios. It rejects wrong-champion or incomplete four-build collections.
- Resource scan found no mana items or Manaflow for non-mana champions. Kennen's initial unsuitable package was replaced with mana-free damage/protection packages; regression coverage checks the whole non-mana roster.
- Browser checks: Cassiopeia, Aatrox, Tahm Kench, Kennen and Zyra load the new collection; Aatrox opens a manual test sheet; Tahm's six earlier proposals remain available under Earlier experiments. The new default shows four.
- Mobile at 390px has document scroll width 375px, with no horizontal overflow. Desktop screenshot: output/playwright/all-champion-builds.png.
- Read-only review identified the resource mismatch and a revision-destination mismatch. Both corrected; follow-up review reported no remaining material findings. Revision briefs now target the selected collection. Preview serves current per-champion workspace JSON through canonical-path validation.
- Candidate packages are shared, with a separately curated question and selection for each champion. This is a research first pass. No in-game measurements, mathematical maxima, historical novelty or match strength are claimed. Numerical adapters still cover only Cassio Q/E and Sett W; the other objectives use manual tests.
- No DeepSeek integration or credentials were added; the user replaced that request with this collection.
