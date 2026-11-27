# Verification and current limits

## Automated checks

Validated on Windows with Node 22, TypeScript 5.9, Vite 6, Phaser 4.2.1 and installed Microsoft Edge through Playwright. The package lock pins the runtime dependencies. Browser fixtures use the real file-import, UI and input paths, with no shipped secret-state browser API.

The rules suite passes **117 checks in ten files**. It covers reproducible generation, reachable public tasks/cover, schedules and transfers, truthful questions and exclusions, restricted NPC observations, 52-copy card conservation, curse tasks, physical capture, full role rotation, save validation/recovery, cosmetic persistence, truthful field-kit preparation and sending, coordinated boarding, bounded hider escapes, resident routines/memory, service incidents and capture presentation. Presentation tests compare the authoritative post-tag state against a control and verify that overlapping events, expiry, Continue and saved results cannot alter scores or replay the effect.

The browser suite contains **51 regular scenarios and two opt-in live-model checks**. All 51 regular scenarios passed across the broad run and focused reruns after the hand/tutorial fixes. Routine fixtures intercept Ollama so play and visual verification remain deterministic and do not consume inference resources.

| Area                     | What is checked                                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Human decisions          | Six truthful field tools, keyboard/controller preparation, sending and rewards; player-approved questions; photo and spatial evidence                       |
| Movement and stealth     | Keyboard, click-to-walk, analog input, sprint, real cover, manual tag, roof fading and same-party travel                                                    |
| Clock and pacing         | NPC head-start skip, protected decision pause, running paperwork, actionable curse hold/completion, 1×/2×/4×/8× selection and saved speed                   |
| World and travel         | All eight district families, route/exclusion map, reserved stopping service, boarding and moving train/bus/ferry/foot scenes; visible repair and resumption |
| Residents                | World-anchored speech, speaking gestures, purposeful saved routes, reachable jobs/breaks/home, bounded model dialogue and memory                            |
| Visual accessibility     | 1280×800, 1366×768, 1440×900, 1848×1000, 880×700 at 140% text; independent HUD lanes and tucked card counter; readable bodies and selected states           |
| Capture                  | Contact/caught moment before results, Continue, automatic completion, static reduced-motion presentation, unchanged scoring and no replay on reload         |
| Persistence and recovery | New/legacy saves, backup recovery, malformed nested imports, separately saved appearance/audio/input preferences                                            |
| Menus and controls       | Indie title, compact menus, notebook/hand disclosure, keyboard focus, synthetic standard gamepad, sound/mute, practice completion                           |

Focused HUD checks and manual screenshot review confirm non-overlapping location, clock, Menu, objective, movement, Map and card-counter bounds at the three dedicated readability sizes. The counter is above the highest tucked card. Dark translucent backplates maintain contrast on bright ground: the key HUD text measures 10.21:1 even when composited over white, the question guide 7.77:1, and window clock status 5.46:1. Values are in artifacts/release/text-contrast.json. Body text is Atkinson; short game headings/timer use Pixelify. The world canvas fills the viewport, exceeding the requested 70% playing surface.

Rendered evidence is under artifacts/field-play/, artifacts/brand/ and artifacts/release/. Current captures include readable-hud-1848.png, readable-hud-1280.png, readable-hud-880.png, answer-prepared.png, answer-photograph.png, tag-contact.png, tag-reduced-motion.png, resident-ollama.png, repair-stop.png and the current title captures. Some older artifacts predate this pass; use these named captures for the current direction. Physical controller hardware is not implied by synthetic Gamepad API checks.

## Timing and hiding measurements

Run node scripts/balance-check.mjs for 24 complete matches: four starting seeds, three difficulties, four-minute versus six-minute searches. The report includes questions, curses, escapes, transit/wait stages, local-search durations and progression outcomes. The refreshed run had zero stalls and forfeits: four-minute searches produced 20 captures in 39 turns; six-minute searches produced 32 in 36. Both groups averaged 1050 simulated seconds per match. See QUICK-MATCH.md and artifacts/release/balance-check.json. These automated NPC matches are progression/pacing evidence, not human win rates or enjoyment results.

Run npm run audit:stealth for reproducible public-geometry cover probes, isolated stationary-hider searches and sprint/detection measurements. The audit's 1200-second local cap is intentionally longer than a normal match. The refreshed audit covers 60 districts and 110,622 probes with zero omissions. Its eight isolated stationary-hider captures take 64–367 game seconds; the rural trial exceeds the six-minute cap. A complete public patrol does not establish capture within six minutes against a moving player. Sprint remains 1.65× and increases sightline visibility; no stamina rule was added without human evidence.

## Local models

Ollama is optional and separately installed. Only loopback model discovery/chat is used. Travelers receive legal role-specific choices and public evidence; residents receive occupation, local hour, recent short memories and visible nearby people. Hidden positions, private card hands and correct answers are absent from resident/seeker prompts. Model text is never authoritative investigation evidence. A slow, invalid or unavailable response leaves the ordinary simulation/routines in control.

The opt-in actor and resident checks use an installed local model in an isolated browser profile. RUN_OLLAMA_SMOKE=1 enables them. Both opt-in live checks passed against the installed local service: a validated actor plan, and a civilian conversation with saved memory. The actor check was rerun successfully after an initial discovery timeout; offline fallback remained available. No model is downloaded by the game or test suite.

## Windows build

npm run release:windows builds the static bundle, offline cache, x64 .NET Framework launcher, zip and SHA-256 file. npm run verify:release exercises the executable's loopback server in an isolated persistent Edge profile: 40 stations, save/resume, offline reload, audio preferences, local support export and browser restart. It rejects a busy desktop-game port instead of stopping a user's game. The packaged executable, 40-station game, offline reload, save/resume, persistent audio preferences and browser-profile restart passed with no application errors or failed asset requests.

The launcher serves bundled files on IPv4 loopback and opens installed Edge in an app window. The distribution requires 64-bit Windows, Edge and .NET Framework 4.8, and is unsigned. The substantial Phaser engine chunk is intentional; all runtime assets are bundled locally.

## Remaining manual gates

- Five observed human sessions, deduction comprehension, voluntary replay and actual wall-clock match duration; protocol in PLAYTEST.md.
- A physical controller, disconnect/reconnect and focus/fullscreen transitions.
- A second clean Windows computer, update/save recovery and declared minimum hardware/frame rates.
- Publication and code signing in a chosen channel; no public release has been claimed.

Towns use procedural variations of authored neighborhood families, not GIS or a continuous real-city model. Vehicle interiors are visual journeys rather than walkable levels. Residents in the visited town follow small saved routines; offscreen towns are not a continuous economy or full life simulation. New geography and the revised Quick cap apply to new sessions; older saves keep their stored world and rules.
