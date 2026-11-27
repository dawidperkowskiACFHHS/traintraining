# Last Stop 1.1.0-rc.2

This candidate adds a complete playable introduction, clearer deduction evidence, a local synthesized soundscape, shorter match formats, explainable search settings, save recovery, and an offline Windows distribution. Its interface has been distilled around the world rather than around persistent utility panels.

## New in this candidate

- Tags have visible contact feedback, caught/reaching poses, a short chime and a skippable TAG moment before a compact result window. Reduced motion keeps a static pose/marker, and saved results never replay or double-score the effect.

- Small dark HUD backplates, separate control lanes and a card counter above the fan keep labels readable without overlap. The clock exposes 1× normal speed plus 2×, 4× and 8× fast-forward, with bracket-key and controller-menu access.
- A simpler world-first HUD, one Menu entry, small handheld-style dialogue windows and an illustrated indie title. Readable sans-serif copy replaces pixel paragraphs; the tucked card fan stays out of movement.
- Saved resident work, errand, break, lunch and home routines. Optional local Ollama supplies bounded activity choices and dialogue; conversations use anchored speech bubbles and speaking gestures.
- Deterministic fast services, signal delays and short automatic repairs. Route estimates include the condition, repair progress and scenery actually stop, and seekers travel together.

- More detailed traveler sprites, clustered foliage, material-specific facades, roof furniture, entrance details and matching map miniatures. Scenery fades around the player and arrivals spread the party.
- Incoming questions use an interactive field kit and a Send reply action. Every prepared reply is automatically truthful; there are no incorrect-answer options. Photographs preview the actual image sent.
- A true NPC head-start skip, compact routine panels, explicit clock state, actionable curse progress and visible completion.
- Selected itinerary highlighting, recent exclusion marks and a short next-action notice after important events.
- Varied NPC hiding choices and up to two short, sight-based escapes; used attempts persist in saves.
- Reserved services stop separately from through trains, boarding shows the party entering, and train/bus/ferry/foot journeys keep their own visuals. Fullscreen is available on the title and field-tools menu.
- Quick searches now allow six minutes; existing saves retain their stored rules. See QUICK-MATCH.md for the complete-loop comparison.

## Player-facing changes

- The browser tab, touch shortcut, installed app, Windows executable, menu and loading screen now share a pixel train-and-ticket mark. Small icons use a simplified optical variant; install assets include opaque maskable icons. App metadata and theme colors match the game identity.

- Eight district families now have distinct streets, station locations, building plots and architecture. Markets add denser stall alleys, forests connect clearings, and waterfronts follow the shore. Existing saved maps are preserved.
- World-space cover, concealed/spotted and valid-tag cues explain the local search. An audible spotted cue respects audio settings. Successful captures explain range and sightline in results.
- Human-led seeking defaults to teammate suggestions with explicit approval in Ask. Automatic questioning remains a saved Controls & assistance option. Stale suggestions cannot be approved from an old origin.
- Four-direction idle, walk, sprint, crouch, hide, interact and caught poses use the saved appearance. Residents have occupation details and small work routines; train/bus scenery approaches the destination biome.
- Cards produce brief purpose-specific glyphs, titles and particles in the world. Successful play stows the hand; required rewards and reactions retain their focused choices. Reduced motion retains readable static feedback.
- Public-geometry inspection routes cover reachable hiding cells rather than sampling at most 24 extra points. `npm run audit:stealth` records coverage and isolated capture trials. Support reports include movement/sprint time by phase and role, stored locally with the match. No stamina or sprint speed change has been made without human playtest evidence.

- Learn to play teaches movement, real timetable travel, district commitment, cover, a played card, a truthful question, notebook reading, paired travel and a manual tag. Hints are explicit practice assistance and never expose the target in ordinary matches.
- Quick journey uses six-minute searches and a three-point target; a tie can require another set. Classic keeps the existing ten-minute search cap and six-point target. The 120-second normal head start is unchanged. Practice removes immediate timing pressure.
- Relaxed, Standard and Sharp state the actual seeker speed and sight changes before play. Clues remain truthful and NPC decisions retain their restricted observation boundary. Difficulty is fixed for the session.
- Clues retain origin and previous-journey stations. Expandable explanations show the inconsistent answer each excluded district would have produced, using the same public evaluator as the simulation.
- Original locally synthesized music, footsteps, cover rustles, card sounds, questions, arrivals, results and vehicle ambience have independently saved levels. No audio samples or inference model downloads are required.
- Residents stand on walkable geography, have station-specific identities and react to public context. District scouting describes actual cover/building geometry rather than fictional bonuses.
- Save imports validate nested world, actor, evidence, card and settings data before replacing the current state. An automatic previous-save slot supports recovery. Preferences persist separately from matches, and an unexpected-error panel provides recovery/report actions.

## Interface cuts

The card hand now rests below the screen with a small fanned peek. Hover or focus reveals it; R/controller LB opens it for arrow/stick navigation and Enter/A inspection. Escape/B or movement stows it. Reward, reaction and overflow choices still show in full, and motion reduction applies to the fan.

The title has one primary action, a playable-intro entry and compact utility links. New journey exposes only format and difficulty; custom worlds and practice variants are expandable. Settings begins with text, motion and master sound, with secondary controls grouped by purpose. Map stays immediately visible; Menu contains questions, notebook, party commands, cards, help and session tools. Keyboard shortcuts remain available. Escape/controller Start opens this paused menu. Keyboard and controller can operate disclosure controls.

Vehicle scenes now use one destination/route plaque. Repeated status boxes, a duplicate travel-speed window, decorative labels, the persistent deck count and the title's filler caption were removed. Native disclosure state survives asynchronous NPC connection updates. No gameplay options were removed.

## Delivery

Extract `releases/Last-Stop-Windows.zip` and run `Last Stop.exe`. It serves the bundled game only on IPv4 loopback and opens an installed Edge app window using a dedicated local profile. A named local restart event allows a new build to replace its previous local server without moving the browser origin or losing that profile. The game assets are bundled and a service worker also supports offline browser reloads. The launcher requires 64-bit Windows, Microsoft Edge and .NET Framework 4.8. It is unsigned.

Build from source with `npm run release:windows`. The zip, a SHA-256 checksum file, credits/licenses, START-HERE.txt, feedback.html and the playtest protocol are generated or included. `dist/` is the separately publishable static browser build; it has not been uploaded to a public host or store.

## Evidence and remaining release gates

See `docs/VERIFICATION.md` and `artifacts/release/` for automated results and normal-size captures. `scripts/balance-check.mjs` compares complete matches across four starting seeds, three difficulties and two search caps. See `docs/QUICK-MATCH.md` for measured results; these simulations do not establish human enjoyment or win rates.

Real-player observation, a physical controller, a second clean Windows machine, and declared minimum hardware remain pending. The supplied five-player protocol, local feedback form and opt-in exported support report make those checks concrete. Reports are downloaded locally and never uploaded automatically. Public publication and code signing require a chosen channel and publisher credentials; neither has been claimed as completed.
