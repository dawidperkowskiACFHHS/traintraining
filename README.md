# Last Stop

## Windows release candidate

Run `npm run release:windows` to generate `releases/Last-Stop-Windows.zip`, then extract it and double-click **Last Stop.exe**. Generated releases are kept outside Git. The launcher uses a dedicated Edge app window and bundled offline assets; players do not need Node or a terminal. Requires 64-bit Windows, Microsoft Edge and .NET Framework 4.8. This candidate is unsigned. To move an existing browser/development match, export it from the old game and import it through Settings → Saves & recovery in the Windows app. Source/development instructions follow below.

Choose **Learn to play** for a hands-on introduction covering both roles. **New journey** defaults to Quick (six-minute searches, three turns unless a tie needs another set); Classic retains six-point matches and ten-minute searches. Difficulty explains the seeker speed and sight changes before play.

Map stays visible; **Menu**, Escape or controller Start opens the paused field-tools menu. Q opens Ask and N opens Notes. Settings groups detailed audio, controls, AI, save recovery and support tools into expandable sections. All options apply immediately.

The soundscape is original, synthesized locally: music, footsteps, cover, cards, question/answer cues and vehicle ambience. Separate master/music/effects/ambience levels persist between sessions. Save imports are validated and a previous autosave can be recovered through Settings. No analytics or reports are uploaded automatically.

For release verification run `npm test`, `npm run release:windows`, `npm run verify:release`, and `npm run test:browser` in sequence. The browser tests currently use the local dev server. `node scripts/balance-check.mjs` records deterministic match baselines. [Playtest protocol](docs/PLAYTEST.md) separates automated checks from real-player and physical-controller gates.

A playable single-player travel and deduction game. Walk through original pixel towns, take scheduled trains, hide from Mira and Kit, then team up to find them. All places, characters, art and adaptation rules are original.

## Run

Requires Node.js 22.12 or newer and npm. Tested with Node 22.19 on Windows and Microsoft Edge.

```sh
git clone https://github.com/dawidperkowskiACFHHS/traintraining.git
cd traintraining
npm ci
npm run dev
```

Open **http://127.0.0.1:5187**. New journey starts with format and difficulty. Expand World & practice options to choose a seed, 20/30/40 stations, or practice roles. No account, external map, inference service or runtime asset download is needed.

**Ollama NPC AI is enabled by default.** The game connects to the local Ollama server at `http://127.0.0.1:11434`, discovers installed local models and automatically selects the smallest. In **Settings → Local NPC AI**, choose another installed model, reconnect, or switch to classic NPCs. Your choice persists between sessions. The game never downloads a model automatically.

If Ollama is installed but stopped, open its desktop app or run `ollama serve` in another terminal. If no models are installed, add one using Ollama, then select Reconnect. The game remains playable with classic NPC behavior while a model is unavailable, loading or thinking. An unavailable connection retries periodically.

The model guides questions, travel/search choices, hiding destinations/corners and legal card plays. Mira and Kit retain distinct personalities. Model dialogue is shown as a **Plan**, while questions and clue answers remain calculated by the game. Each NPC gets its own role-appropriate observations; seekers receive no hidden hider position. The simulation validates every action and retains collision, cooldowns, costs, visibility and capture rules. No executable tools or arbitrary model commands are accepted.

The integration uses Ollama’s official [model discovery](https://docs.ollama.com/api/tags) and [chat API with structured output](https://docs.ollama.com/api/chat). If a browser connection is blocked, check Ollama’s [local origin configuration](https://docs.ollama.com/faq). Running the game through the localhost development/preview server is recommended.

```sh
npm test                 # deterministic simulation and rules tests
npm run build           # type check and produce dist/
npm run preview         # serve the production build
npm run test:browser     # browser interaction tests; start npm run dev first
npm run audit:stealth   # cover coverage, isolated captures and sprint measurements
npm run assets:icons    # export browser, install, touch and Windows icons
npm run assets          # regenerate the 24 bundled original card illustrations
npm run format          # format project source and documentation
```

Browser tests use installed Microsoft Edge. On another platform change `channel: 'msedge'` in `playwright.config.ts` to a locally installed Chrome channel, or remove `channel` and run `npx playwright install chromium`.

## Play

**WASD / arrows** walk. Click an accessible tile to walk there. **E** interacts, opens railway planning near the station, talks to residents, or explicitly tags a visible hider within reach. **M** opens the regional map; **Q**, **N**, **T**, **C** open questions, notes, teammate commands and the card guide. **Space** pauses everyone. The visible clock buttons select **1×, 2×, 4× or 8×** speed; **[ / ]** steps between rates. Menu also cycles speed with keyboard/controller input. Escape closes a panel. Movement, interaction, map and pause bindings can be changed in Settings.

Hold **Shift** or the controller **right trigger** to sprint at 1.65× walking speed. The on-screen **Sprint** toggle also works with click-to-walk. Sprinting makes a character visible from farther away along clear sightlines. Both sprint and hide keys can be rebound in Settings.

Stand inside a bush or hedge, or just behind a crate, then press **H**, controller **X**, or click **Hide** to conceal yourself. The button lights up when cover is close enough. Stay still: movement or pressing Hide again breaks concealment. Seekers can discover and tag you by inspecting from close range; cover is not invulnerability. Walls, trees and crates also block actual sightlines. Your chosen cover is retained when local search begins. You can keep moving within the district and hide again beside walls, trees, stalls, benches or other solid cover.

New games generate irregular settlement locations, curved railways, winding streets, offset buildings, rivers and uneven shorelines. Start a new match to see the new geography and cover placements. Existing saved worlds keep their original layouts and remain playable.

Menu → Notebook expands the live notebook; its close button folds it away. Menu also contains settings, saves and secondary tools; Escape or controller Start opens it. Cards peek out from the bottom in a small fan. Hover, focus, **R**, or controller **LB** opens the hand. Arrows/stick browse, **Enter / A** inspects, and **Escape / B** stows. Moving or successfully playing a card also stows the hand. Required rewards, reactions and overflow choices remain fully visible.

Click your portrait, press **V**, or select **Customize character** in the match menu or Settings to edit your traveler. Choose a skin tone, hairstyle, hair color, shirt, trousers, and no accessory, a cap, or a backpack. Four walking previews update together; **Randomize** creates another combination. **Save appearance** applies the look to the world, portraits, and regional/replay map marker. **Cancel**, Escape, or gamepad B leaves it unchanged. Your look is saved locally between sessions and new matches, and included in exported match saves. Older saves remain compatible.

Gamepad **View / Back** opens the editor. Use the d-pad to focus a selector, **A** to edit, d-pad to change its value, and **A** again to finish editing. Navigate to **Save appearance** and press A to keep it, or B to cancel. The editor pauses the game clock. Reduced motion starts its walking preview paused; **Animate preview** explicitly enables it.

To hide, choose **New journey → Start game** to begin the head start, plan a timely trip on the map, and select **Walk to platform & travel**. This walks to the platform, waits for scheduled departures, transfers and disembarks. Commit to an eligible district beyond the common starting station before the deadline. Explore the streets, alleys, café, library and open homes. A small arrow and foot ring identify your traveler. Teal doorways are enterable; roofs cut away inside.

To seek, ask questions and review the notebook’s verified exclusions, station postcards and personal theories. Both seekers share one cooldown. Tell your teammate to follow, search the current district, inspect the nearest hiding corner, meet at a station, handle a curse, or suggest a plan. Your teammate suggests a question in **Ask**, showing its origin and hider reward before you approve; you can choose your own question instead. Enable automatic questioning in **Settings > Controls & assistance** if preferred. The teammate follows the party leader, boards the same service, shares observations and can tag the hider. Commands to meet or handle a curse route the party together.

When seekers reach the hiding district, manual movement remains available. Break sightlines, hide again or play a card. Emergency Exit adds a six-second 25% speed burst to a bounded, visible, capturable relocation. The private local-endgame trigger does not reveal a district to the seekers.

Orange curses delay movement or investigation. Blue tools change your options. Purple bonuses count only while retained. Inspect a hand card to read its rules and select any **additional** discard costs. A pending question and human reward selection tactically pause every participant. Match printed stamps to clear paperwork, or enable automatic simplified resolution. Seekers perform shared errands together.

The default head start is 120 game seconds and the search cap is 600. Search survival plus the best two qualifying retained bonuses, capped at +120 seconds, determines hiding scores. Everyone hides from the same starting station during a set. Rank the three turns for 3/1/0 points, with survival breaking bonus-score ties. Exact ties share placement points. Forfeits receive zero. A unique leader at six or more wins only after a complete set; a tied lead requires another set.

## Saves and accessibility

The game autosaves to browser local storage every seven seconds while playing, on a window/tab handoff, and at round transitions. **Save** writes immediately. **Settings → Export save** creates a portable JSON file; **Match menu → Import save** restores it. Saved state includes the generated region, clock, exact journeys, random stream, hand/deck/discards, pending choices, active curses and tools, sampled puzzle completion times, knowledge, notes, event log, results and settings. Backgrounding the game pauses it; elapsed offline time never adds score. Loading resumes at normal speed.

Settings include 100–140% text size, reduced camera motion/animation, optional pause while reading panels, simplified paperwork, sound, and keyboard rebinding. A standard gamepad supports walking, interaction, map, pause and panel focus/selection. Hardware controllers have not been physically tested; automated tests exercise the standard browser gamepad mapping.

## Project map

- [Architecture and rule decisions](docs/ARCHITECTURE.md)
- [Art direction](docs/ART_DIRECTION.md)
- [Foundation assessment and research](docs/RESEARCH.md)
- [Verification and current limits](docs/VERIFICATION.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

This is an original digital adaptation inspired by travel hide-and-seek. It is not an official rules implementation or affiliated production.

## Illustrated adventure update

The world fills the screen beneath compact floating controls. The title menu, smooth readable fonts, illustrated cards, pocket notebook and larger selected states share one adventure style. New journeys get a fresh seed by default; entering an explicit seed reproduces the region and initial question preferences. Useful legal questions still take priority over seeded tie choices. Train, bus and ferry rides show animated vehicle interiors and passing scenery, and respect pause and reduced-motion settings.
