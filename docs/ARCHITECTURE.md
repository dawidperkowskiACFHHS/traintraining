# Architecture and rules overview

## Runtime boundary

Manual input is applied inside the authoritative simulation steps. If a question interrupts fast-forward, walking stops at the same step as every other participant; unused frame time cannot become extra movement. Rules and personality parameters live in `src/content/balance.json`.

One TypeScript simulation owns the generated world, all three travelers and one authoritative game clock. Phaser 4.2.1 renders that state; semantic HTML provides the field notebook and controls. No Phaser timers own game rules. Browser frames submit manual walking and advance the simulation with the same game seconds. Integration divides long advances into at most 0.1-second steps. Walking consumes the entire movement budget across tile boundaries, so route estimates and bounded card movement agree.

| Module                       | Responsibility                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `types.ts`                   | Serializable world, actor, match, effect, evidence and save contracts                               |
| `random.ts`                  | Seed hashing, deterministic PRNG, shuffle and sampling                                              |
| `world.ts`                   | Persistent region, geography, schedules, earliest-arrival routing and validation                    |
| `local.ts`                   | Tiled neighborhood modules, collision, reachability, walking paths and line of sight                |
| `content/neighborhoods.json` | Eight authored neighborhood object layers in Tiled JSON format                                      |
| `questions.ts`               | 22 question templates, explicit anchors, truthful answers, exclusions and information gain          |
| `cards.ts`                   | All 24 immutable designs, 52-card composition, legality and bonus qualification                     |
| `transit.ts`                 | Distinguishes waiting reservations from actual in-transit movement                                  |
| `ai.ts`                      | Seeker goals selected from a restricted public observation contract                                 |
| `npc-advice.ts`              | Role-specific legal action menus, bounded model replies and expiring advice                         |
| `ollama.ts`                  | Local model discovery, persisted connection preferences and asynchronous NPC inference              |
| `simulation.ts`              | Shared legal actions, phases, clock, travel, cards, tasks, capture, NPC execution, scores and saves |
| `art.ts`                     | Original deterministic town textures, four-direction travelers and scene postcards                  |
| `appearance.ts`              | Validated cosmetic palettes, hairstyle/accessory choices and independent cosmetic randomization     |
| `character-editor.ts`        | Compact draft editor and four-direction animated preview markup                                     |
| `scene.ts`                   | Phaser scene, camera, characters, visible paths, trains and effect markers                          |
| `ui.ts`                      | Notebook, regional map, questions, cards, rewards, settings, tutorial, results and replay           |
| `main.ts`                    | Browser input, controller mapping, actions, audio, local persistence and frame integration          |

Human and NPC movement, travel, questions, card plays and tags use the same action functions. Immutable card definitions contain no per-player mutable state. Each match owns its own RNG, deck, choices, effects and plans.

## World and authoring

The region is generated once for a match. Seeded best-candidate samples around settlement clusters produce irregular positions, rejecting sea/boundary and landmark interiors instead of clamping towns into rows. A minimum-distance backbone guarantees connectivity; nearby connections, regional express services, short footpaths and coastal ferries add alternatives. Each new edge records a quadratic bend, shared by the SVG railway and traveling map marker. Older edges without a bend remain straight. World units are fictional straight-line kilometres. Local distances are tiles. Schedules retain departure offsets, service intervals and leg durations; earliest-arrival routing includes waits and transfers. The shared clock continues for everyone during travel.

Town footprints come from eight **Tiled JSON object layers**. Seeded offsets, winding streets, door-to-street footpaths, sinuous rivers, irregular lake/coastal edges and vegetation vary each neighborhood. Road/river intersections become actual walkable bridges. Station platforms remain stable navigation anchors. Open `src/content/neighborhoods.json` in Tiled to edit footprint templates on the 16-pixel grid. `scripts/make-town-modules.mjs` can regenerate the initial authored source; do not run it after hand editing unless intentionally restoring those layouts. Run generation tests after edits.

Each town has a public attraction, bridge/bridge-like crossing, scenic waypoint and station bench. Reachable hiding spots are selected by flood/path checks from the station. A generated world must be connected, have reachable public tasks and at least four valid hiding spots per station, and have multiple reachable head-start destinations. These checks run at creation and in tests.

`Town.cover` records bushes, hedges and crates with explicit inspection/hiding positions. The same record drives foreground art, interaction and NPC search targets. Crates are solid tile 10; vegetation cover is enterable. One flood fill validates the town’s reachable hiding positions, avoiding repeated whole-town searches during generation. `map-art.ts` draws landscape regions and selects label offsets to reduce overlaps without imposing a grid.

## Sprint and concealment

Manual and click-path sprinting share the authoritative movement integration and use 1.65× base speed. Direction vectors remain normalized and collision, movement curses, pauses and local locks still apply. Faster walk frames provide feedback without changing camera or simulation time. Sprinting increases clear sighting range from seven to ten tiles; walls still block it. Keyboard Shift, controller right trigger and the visible toggle provide equivalent controls.

H/controller X/the Hide button toggles concealment within 0.85 tiles of a cover position. Movement cancels it. A hidden character stays absent from `SeekerView.visibleHider` and enemy rendering until an observer comes within 1.6 tiles with line of sight; tagging still requires 1.35 tiles and a clear ray. NPCs inspect public cover positions as part of their normal sweep, rather than receiving hidden positions. The local endgame preserves a deliberately selected hiding position; the human remains free to move within the committed district and hide again. New actor flags and binding defaults migrate on save import; existing saved world geometry is retained.

## Round state machine

Preparation → head start → search → results → next hiding turn. Search internally records when the local endgame begins; it does not broadcast a true district. Search scoring starts only at the search transition. The hider must commit after arriving beyond the starting station. Being on a journey, missing the deadline or failing to commit forfeits the turn. Legal hiding districts remain fixed during search.

The first off-transit seeker in the real district starts local settling. The hider follows a physical route to the nearest eligible hiding spot; ordinary movement locks, with the exceptional relocation action remaining available. NPCs sweep valid spots, use actual sight lines, and explicitly invoke the same tag action as the human. Tags require distance ≤1.35 tiles and unobstructed line of sight. Rails, walls, trees and deep water block local visibility in this adaptation.

Local search is available in any district. NPCs share completed corner inspections and avoid reserving the same search spot. Physical patrols use public geometry-based inspection points and do not prove a whole district empty. Verified question evidence excludes districts. Relocation resets current local search coverage and marks exact-position evidence stale.

## Knowledge boundary and NPCs

`seekerView` is the authoritative observation adapter. `seekerPlan` receives the world’s public geography, its own actor, its teammate, candidates, legal questions, public curse tasks and a hider point **only when actually seen**. It receives no secret hider actor or committed district. Question selection evaluates possible answer partitions over the public candidate list; it never queries the real answer. Routing uses public candidates and public teammate destinations. Reports and confidence statements come from that belief set. Tests perturb a hidden hider’s district and verify identical seeker observations.

The first seeker is the party leader. The other follows nearby, catches up at sprint speed and shares the leader’s exact timetable legs. Autonomous leaders wait for their companion before walking too far ahead or boarding. Both use information gain, route cost, visited districts, actual perception and task goals. Hiders choose reachable destinations using seeded concealment/ambiguity variation, physically travel, commit, find cover, retain valuable bonuses and play legal cards. Memories of revealed hiding turns remain with the same two characters throughout the match. These classic planners remain the immediate fallback; optional local model advice can select among validated alternatives and supply short planning dialogue.

Event visibility is recorded when an observation is made and saved with the event. A later sighting or reveal card cannot retrospectively expose previously unobserved seeker journeys. Revealed information remains timestamped after the live reveal ends.

## Questions and evidence

Matching (5), measuring (5), radar (4), thermometer (2), tentacles (3), and photos (3) provide 22 usable templates. Every template declares its fixed station, fixed district or current-position anchor. Matching rewards draw 3/keep 1, measuring 3/1, radar 2/1, thermometer 2/1, tentacles 4/2 and photo 1/1. Thermometers require a completed journey of at least 5 km. The two seekers share the queue and 20-second cooldown. An answered template cannot be repeated from the same anchor; a canceled one is blocked for 60 seconds.

Answers eliminate only candidates inconsistent with the same truthful evaluator. Position photos do not automatically exclude districts. Photos are interface-free crops of the deterministic town, including an interior cutaway when photographed indoors. Station-frontage and landmark postcards have validated subjects and preserve their geographic validity after local movement. Exact-position postcards can become stale after relocation. Evidence timestamps use simulation time; annotations remain unverified personal theories.

## Cards and costs

Twelve curse designs have two copies each, eight tools have two each, and four bonuses have three each. The total is 52. Start with three, normal hand limit five, maximum seven. Validate the complete action before discarding either the played card or additional costs. Pending rewards are saved separately from held cards. Costs refer to additional distinct hand indices. A failed target, slot, timing or prerequisite check pays nothing.

One movement and one investigation curse may coexist. Identical effects do not stack. Ordinary cards share a 10-second cooldown; reactions can change a pending question once. Active curse and tool copies stay out of the discard reshuffle while active. Draw selection and overflow resolution tactically pause the whole world for a human hider.

Physical tasks have path-validated, distance-bounded targets. Either seeker can complete them; continuous dwell resets on leaving or changing workers. Natural expiry and voluntary cancellation do not count for souvenirs. Paperwork has a real stamp-order interaction, a ten-second minimum and a thirty-second maximum. An NPC completion time is sampled once, saved, and falls inside those bounds. Simplified mode resolves it at ten seconds. Its task panel explicitly keeps the simulation moving. Pausing the game still freezes the task.

Wrong Platform blocks new local/express train boarding while preserving existing rides, footpaths and ferries. New restrictions are checked at transfers. Five More Minutes requires both seekers to be physically off transit; it cancels waiting reservations, stops walking and boarding, and reschedules journeys afterward. Ordinary questions remain legal. Right Is Right forbids left turns and reversals at street junctions while allowing a dead-end escape; the rule is shared by manual and NPC movement.

Emergency Exit validates another same-district hiding spot with a route ≤15 seconds before paying its two extra discards. It follows that path without teleporting, announces relocation, remains capturable and can happen only once. Bonuses score only from retained cards: best two, total ≤120 seconds. Souvenirs track distinct actively cleared designs. Still Here Somehow requires sixty seconds after local search began.

## Match and save decisions

The human hides first in Full Match, followed by Mira, then Kit. Everyone starts their turn from the same station in a set. A later set chooses another validated station. After all three turns, rank by bonused score, then survival. Exact remaining ties share the points at that rank; forfeits receive none. A unique leader with at least six points wins only at set boundaries. Tied leaders continue another entire set.

Ruleset version 1 saves the complete simulation, including generated maps, RNG, sampled outcomes, NPC paths and memory, pending questions/rewards, active effects/tools, clock, set/round order, notes, evidence, results and event log. A restored save does not regenerate or resample. Pause, hidden tabs and reading panels (when enabled) freeze authoritative time. Fast-forward advances every participant and stops on arrival, search start, cards, questions, local warning and results. Replays show only completed turns, with all three roles revealed after the turn. The timeline uses recorded positions and travel/action events, rather than attempting to re-run a changed RNG stream.

The serializable state/action separation is suitable for a later authoritative host. Multiplayer networking and rollback remain outside the single-player runtime.

## Local model NPC guidance

`ollama.ts` owns the browser connection to `127.0.0.1:11434`, model discovery, a single in-flight request, a 30-second generation timeout and periodic reconnects. It defaults on, chooses the smallest installed local model and stores enabled/model preferences at `last-stop-ollama-v1`. Cloud-tagged or remote model entries are excluded. Requests are limited to one at a time and at least eight wall-clock seconds apart; paused/background/menu states do not start planning requests. Classic simulation ticks continue while inference runs.

`npc-advice.ts` builds bounded action menus. Seeker menus originate from `SeekerView`, with public candidates, legal questions, public search locations and teammate commands; the prompt adds only already-answered evidence. Hider menus contain their own legal destinations, cover positions, hand and timestamped known seeker locations. Prompts are fresh per NPC, with no shared conversational history. The model returns a structured `{choice,line}` object and can select only a supplied action index. Text is bounded and escaped by the existing UI.

Advice lives in a WeakMap outside serialized state. It is rejected across new state instances/rounds/roles, expires after sixty game seconds, and drops stale walks after a station change. Turning AI off clears queued advice and aborts the request. Questions, routes, reachable movement targets, immutable card identity and additional discard costs are checked again by ordinary simulation actions. Hider private plans never enter teammate radio. Executed actions and public planning dialogue are recorded through normal events; saves and replay remain authoritative.

The default browser fixtures intercept Ollama requests so regression runs use no installed model resources. An opt-in live smoke test removes that interception and verifies a real local model plan becomes an actual NPC action.

## Character appearance

`State.appearance` stores six bounded palette/shape indices. `normalizeAppearance` validates both imported saves and the local profile. Version 1 saves without the field use the current profile (or the original traveler), preserving compatibility. The browser stores the applied profile separately at `last-stop-appearance-v1`, copies it into new matches, and embeds it in exported match saves. Resume uses the current local profile when one exists; importing a match explicitly adopts its included look. Startup profile edits and tab handoffs never replace an existing saved match with the fresh menu preview world. Match writes begin after creating, resuming, importing, starting or explicitly saving a match.

The editor keeps a separate draft in UI state. Saving commits it; Cancel/Escape/gamepad B discards it and returns to the previous panel. New-game form choices survive this round trip. The whole simulation pauses while the editor is open, independently of the reading-panel setting. Randomize uses a separate cosmetic random source and cannot alter the deterministic match RNG.

`playerCanvas` extends the original character renderer with palette and silhouette choices. The Phaser scene rebuilds the twelve human direction/pose textures only when the appearance key changes, switching textures before removing the previous set. NPC textures remain fixed. A bounded `avatarArt` cache supplies the same player portrait and four-direction walking atlas to the editor, HUD, match menu, Settings, results and map/replay marker. No runtime asset request is needed.

## Illustrated adventure interface

`adventure.css` and `layout.ts` provide a full-screen world with floating location/clock plaques, a pocket notebook, a readable illustrated hand and quick commands. `run.ts` creates fresh default seeds without changing the deterministic explicit-seed engine API. Each round stores an independent seeded question preference order; information gain and legality remain primary. Old saves receive deterministic defaults.

`journey-scene.ts` renders a timetable-driven vehicle interior on a separate canvas. It changes presentation only; routes, departures, arrival and party position remain simulation-owned. Body visibility classes fold walking controls and the hand away during active travel. `art.ts` supplies cropped foreground textures, and `scene.ts` sorts these against character depth. High-resolution text textures keep world signage readable.

## Release candidate and progressive menus

`session.ts` applies opt-in Quick/Classic and search presets to newly created UI sessions while the engine API retains its classic defaults. `coach.ts` advances a saved practice state only after real actions; successful completion requires the human tag result. `audio.ts` owns a gesture-unlocked Web Audio graph, original procedural score/noise sources, discrete event cues and separately mixed buses. It does not advance or pause simulation time.

`storage.ts` retains a validated previous autosave and independent preferences; `save-validation.ts` rejects damaged nested state before renderer/simulation assignment. `release.ts` supplies offline registration, local error recovery and user-exported reports. The Windows x64 launcher is an installed-Edge app host with a loopback-only read-only file server and a stable dedicated profile/origin. `scripts/verify-release.mjs` checks the packaged server and browser assets, offline reload and persistence across a browser-process restart; native window and physical hardware checks remain manual.

Menus use static native disclosure markup and recorded UI open-state. Summary clicks record the next state synchronously, before default toggling, so a focus-triggered repaint or an asynchronous local-model update cannot erase an expansion. Secondary field tools are a focused, paused drawer. Escape repeat is ignored to prevent menu flicker.
