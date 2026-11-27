# Last Stop: art and interface direction

## Core experience

Explore a colorful railway region, hide in its towns, and investigate as a coordinated pair of seekers. The world fills the viewport. Keep ordinary play free of permanent panels; show a window when a player is making a decision or reading something they requested. Preserve Phaser 4.2.1 and the shared authoritative simulation.

## Visual language

The title is an illustrated indie-game title screen with a clear vertical menu and small utility links. Gameplay borrows the economical windows, cursors and limited interface palette of handheld RPGs. Do not draw console hardware, chrome, decorative status tiles or a surrounding emulator shell.

Use dark plum (#40374d), pale silver (#c8c7d1), cool green-white (#f3f6e8), muted berry for selected routes and restrained red/amber for danger and timed tasks. The original pixel window border is the 12px nine-slice in public/ui/game-window.svg, rendered at integer scale. Its frame belongs to open menus and dialogue, not every label. Selected answers use both a cursor and a pale fill; selected cards retain a checkmark. Never rely only on color.

The compact ordinary HUD contains location, the persistent HIDER/SEEKER role, the clock and Menu. Small translucent plum backplates and restrained shadows keep labels legible over bright scenery. Separate header grid cells and lower left/center/right control lanes prevent overlap. Map and nearby movement/cover actions sit at the edge of play. The next action appears once. Set/turn/scores, saves, settings, commands and help live in Menu. Escape/controller Start opens this paused menu; existing M/Q/N/T/C shortcuts remain. Notebook can be expanded from Menu. It starts closed. Required answer/reward/overflow decisions remain visible and protect the clock.

Cards rest below the screen in a small fan. Hover, keyboard focus, R or controller LB reveals the hand; focused cards lift. Enter/A inspects, Escape/B or movement stows. Opening Menu also stows the hand. The title, reward, costs and full rules stay readable independently of the illustrations. Printed card colors distinguish curses, tools and bonuses. Illustrations use original expressive adventure characters, ink and cel shading, without franchise characters or copied frames.

## Typography and access

Atkinson Hyperlegible Next supplies readable interface copy and world signs. Pixelify Sans supplies only short gameplay headings, the role label and timer. Barlow Condensed supplies the large title logotype. Avoid pixel fonts for questions, instructions, paragraphs and card rules. Body text starts at 16px and scales to 140%. Preserve keyboard focus, semantic button labels, gamepad navigation, reduced motion and scroll access at 880×700 with enlarged text.

The incoming-question window sits near the bottom and pairs the question/factual guide with a cursor-led answer list. Keep reward copy short, and put the map and reaction cards behind optional disclosure. Incorrect answers stay local and permit a retry; published clues come from the authoritative evaluator. Panel clock labels must match actual simulation behavior. Paperwork runs on the clock; required replies/rewards freeze everyone.

## World and characters

Use 16px terrain tiles, 24×32 travelers, consistent pixel outlines and upper-left lighting. Character faces and accessories must read at the normal game zoom. Seven poses cover idle, walk, run, crouch, hide, interact and caught in all four directions. Customization applies to gameplay, previews, portraits and map markers. Reduced motion freezes expressive animation and particles while retaining actual character movement and state cues.

| District | Materials                                    | Tactical structure                                       |
| -------- | -------------------------------------------- | -------------------------------------------------------- |
| City     | Cool stone, slate roofs, taller pale facades | Courtyards, larger blocks and garden walls               |
| Market   | Ochre paving and varied awnings              | Dense stalls, narrow cross-alleys and covered approaches |
| Coast    | Sand, pale walls and teal roofs              | Shore promenade, inland loop and pier                    |
| Lake     | Grass and timber shore paths                 | Horseshoe around water and sheltered inland path         |
| Forest   | Earth, timber cabins and pines               | Connected clearings and thin trails                      |
| Hill     | Rocky grass, warm roofs and retaining walls  | Switchbacks and short connectors                         |
| Rail     | Concrete, brick warehouses and metal         | Open yards, loading barriers and service lanes           |
| Rural    | Garden rows, cottages and hedges             | Winding lanes and sheltered field edges                  |

Seed variation changes bends, footprints, trees and cover within each family. All doors and task locations remain reachable. Old saved worlds retain their geography. Foreground roofs, trees, stalls and cover fade to 35% over the human character, with a faint silhouette above them. This never bypasses opponent visibility checks. Terrain is drawn separately to avoid opaque duplicate scenery under a faded object. Map miniatures reuse the same architecture and vegetation renderer.

Nearby physical cover has a subtle outline. Concealed and spotted have separate labels and signals; close inspection still reveals cover. Only show E/A: Tag when the same range and sightline checks allow capture. Results explain why a tag succeeded. Sprint increases visibility along clear sightlines. Do not add stamina without human evidence that it improves the loop.

## Residents and dialogue

Residents have station-specific names and recognizable porter, gardener and shopkeeper outfits. Actual saved routines visit reachable work, errands, benches, lunch and home locations. They yield personal space and pause for conversation. Two game minutes advance one local hour from 08:00; lunch and evening routines reflect this clock. Only the visited town is simulated actively; residents elsewhere do not run a continuous economic simulation.

Ollama may choose among legal local activities and supply a short line using occupation, local hour, recent memories and visible nearby people. It receives no hidden districts, private cards or correct answers. Bounded memory and dialogue are saved. Local routines continue while a model is slow, unavailable or disabled. Talk always has an immediate authored response. World-anchored speech bubbles retain the full conversation in Notes. Small gestures accompany speaking; reduced motion removes them. Never present invented model dialogue as authoritative investigation evidence.

## Travel and pacing

A destination remains visible on the walk to the platform. The reserved service approaches and stops; dim through trains are labeled NON-STOP. Boarding shows the party entering the correct vehicle using real journey time. Ferries dock and foot journeys show walking. Inside trains, buses and ferries, scenery gradually reflects the destination. Keep one route plaque, with progress and time, rather than several repeated windows. The clock always exposes 1× normal speed and 2×, 4×, 8× fast-forward, with a visible selected state. Bracket keys step between rates; Menu also cycles rates for controller access. Keep the tucked hand counter above the card art and place movement controls above Map.

Seeded service conditions provide occasional faster trips, signal delays and brief repair stops. Planning includes the actual condition in the ETA. Repairs pause route progress and scenery, explain the remaining stop and resume automatically. Both seekers share the exact booked legs and conditions; no solo boarding or teleportation. Incidents are bounded and never cancel a match or require a modal.

Quick search is six minutes for new sessions; Classic remains ten. Existing saves retain their rules. NPC preparation can be skipped by advancing the same simulation. The hider's choices and at most two short sight-based escapes stay legal and visible when observed. Teammate questions default to suggestions requiring approval; automatic questioning is an explicit assistance setting. Clue notices and map exclusions explain what changed. Curses lead directly to a location/hold task and a clear completion notice.

## Identity and verification

The original cobalt train-and-ticket mark remains the browser, installed-app and Windows icon. Masters are public/brand/last-stop-mark.svg and last-stop-small.svg; regenerate with npm run assets:icons. Keep third-party font licenses and upstream attribution.

Inspect settled play, a dialogue decision, an open hand and a journey at normal playing size, plus 140% text and reduced motion. Use the real save-import and input paths for browser verification. Run deterministic rules, complete-match timing, public-geometry hiding coverage and packaged offline checks. Automated captures do not establish human fun, controller hardware compatibility or minimum hardware; track those in docs/PLAYTEST.md and docs/VERIFICATION.md.

## Capture feedback and compact results

A new authoritative capture triggers a short presentation before results: a world contact ring/burst, a reaching seeker, a caught pose, a brief tag chime and a TAG announcement naming both participants. Continue, Enter, E or controller A skips it. Effects use real time and never change actor positions, tag reach, survival or scoring. Required scoring still happens immediately. Reduced motion removes shake, bounce, sprite stretch and moving particles; a static marker/pose remains. Loading a completed save cannot replay the moment.

Results use one compact window with survival, bonus, score and the three-traveler standings. Repeated framing and excessive padding are removed; detailed scoring rules are expandable. Timeouts and forfeits remain distinct from actual tags.
The introduction's first seeking question is protected from NPC reaction cards so the learner always reaches the evidence step. Ordinary matches and later questions keep their normal card behavior. The hand counter stays stationary between its tucked and open states; the fanned cards lift above it so explicit mouse stowing cannot reopen it through a layout change.
