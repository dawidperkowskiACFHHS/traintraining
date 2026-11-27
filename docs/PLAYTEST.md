# First release playtest

Build: 1.1.0-rc.2. Scope: single-player Windows, keyboard/mouse and standard controller. This is a release candidate; human enjoyment and physical hardware results must be recorded rather than inferred from automated tests.

## Session 1: five new players

Give each participant the complete Windows zip, START-HERE.txt and feedback.html. Do not install development tools or coach their choices. Ask permission to take observation notes; do not record or upload anything automatically.

1. Extract and launch the game without a terminal. Choose Learn to play and complete hiding and seeking.
2. Start a Quick journey on Standard difficulty. Play at least one role rotation. Offer a complete match or save/resume if the participant wishes to stop.
3. Ask them to explain their immediate goal, a clue after moving stations, one clever decision and why a capture or survival happened. Record pauses, repeated inputs, help requests and reasons for stopping.
4. Ask whether they voluntarily want another journey. Do not substitute a numeric rating for that decision.
5. Export a support report through Settings and complete feedback.html. Both files remain local until the participant deliberately shares them.

Proposed gates: at least 4/5 launch and complete practice without coaching; at least 4/5 explain an old clue from its original station; at least 3/5 voluntarily continue after role rotation. Record actual wall-clock match length. A default Quick journey caps each search at six game minutes and ends after one set with a unique leader; ties can extend it. Classic retains ten-minute searches and a six-point target. Paused reading time adds wall-clock time.

## Session 2: reliability and input

- Test the release zip on two clean Windows machines, including the declared lower-spec candidate. No Node/npm or global development tools may be required. Record OS, Edge version and hardware; minimum supported hardware remains unclaimed until measured.
- Test a physical standard controller: every required action, remapping, menus, disconnect/reconnect, focus loss, fullscreen and return to keyboard. Synthetic Gamepad API checks do not satisfy this gate.
- Check the tucked card hand with mouse, R and controller LB. Browse all seven cards after increasing capacity, inspect/play with Enter/A and stow with Escape/B. Repeat with 140% text and reduced motion; rewards and question reactions must remain fully visible.
- Play a 40-station journey with the support report's frame timing samples. Target 60fps on the intended machine, with no sustained sub-30fps periods or input stalls. Separate startup/loading from settled play.
- Pause, background the window, sleep/resume Windows, save and close, then reopen. Install the next release into another folder and verify the existing profile/save remains available. Export a portable backup first.
- In a disposable browser profile, damage the primary save and recover the backup. Import invalid JSON and check that the active match is retained. Disable local storage and verify an exported save is still possible.
- Test without Ollama, with Ollama offline, and with one installed local model. The base game must remain playable in every case. Test difficulty with classic NPCs before comparing model guidance.

## Strategic variety

Compare the new eight district families. Hide once in a market alley and once at a forest clearing, then seek in both. Record whether the player uses different routes, remembers a landmark without reading its name, predicts when cover will break, and can explain why a tag succeeded. Check that each of the four movement directions reads correctly while running and hiding. On a train or bus, cover the destination text briefly and ask the player to identify the approaching environment.

During human-led seeking, observe whether players review the teammate proposal, predict what it will distinguish and approve it deliberately. Compare one turn with automatic questioning enabled. Record unwanted interruptions and which mode the player prefers; synthetic approval tests cannot establish this preference.

For sprint, export a support report after both roles. Its `movement` field records actual moving seconds, sprint seconds and distance by phase/role across the saved session. Compute sprint seconds / moving seconds separately for head start, hiding search and seeker search. Ask the player why they released sprint. Near-continuous use alone is not proof that stamina would improve play. These measurements remain local until the player exports and shares the report.

Run `npm run audit:stealth` for reproducible hiding probes, isolated stationary-hider trials and controlled sprint speed/detection measurements. The 1200-second isolated audit cap deliberately exceeds a normal Quick search; a completed inspection plan does not guarantee discovery within six minutes. Real-player balance results remain to be collected.

Play fixed seeds `coastal-crossings`, `market-maze`, and `woodland-detour`, then a fresh seed. Use both hiding and seeking. Record routes, preferred hiding objects, question sequence and card choices. The names label test seeds; they do not promise a specific generated biome. Reject a proposed content expansion until repeated observations show the same low-risk tactic dominates materially different maps.

## Release decision

Resolve progression blockers, misunderstood rules and repeated pacing failures first. Then tune sound and feedback against observed use. Keep original licenses, credits, screenshots and release notes with the candidate. Public hosting, store publication, signing and real-player results remain explicit release activities; a local build is not evidence that those occurred.

## New decision and clarity checks

- As a seeker, skip the rest of an NPC head start. Confirm the hider still reaches a district and cover and no preparation is skipped for the human hiding role.
- As a hider, prepare a comparison, distance, radar, journey, nearest-marker and photo reply. No false-answer choices should appear. Check that preparation alone sends no evidence or reward; Send reply publishes the computed truth. Compare the camera preview with the seekers' photo, then finish rewards using mouse, keyboard and a physical controller.
- Clear Bridge Club by following its directions and holding for 15 uninterrupted seconds. Leave midway and confirm progress resets; ask the player to explain why a question is blocked. Completion must be visible without opening the notebook.
- Count unwanted interruptions with compact investigation and paperwork panels. At 140% text on an 880×700 window, all stamps and Submit must remain reachable. Check every clock-running/paused label against actual simulation movement.
- Follow the highlighted itinerary and explain the latest crossed-off places. Keep the destination visible while approaching the station, identify through trains versus the booked service, watch boarding, and compare train, bus, ferry and foot views.
- Watch an NPC see approaching seekers and escape. The fallback allows at most two short local escapes with cooldowns, using visible threats only. Check whether the movement and notice feel fair, and that seekers remain together. Reload must retain used escape attempts.
- Walk behind a roof, tree and stall and confirm the character remains readable. Check that fading scenery never reveals an otherwise hidden opponent.

Compare complete four-minute and six-minute searches with matched starting seeds using the balance-check script. Record human match length and captures separately from the automated comparison in QUICK-MATCH.md.

## Resident and service checks

- Meet a porter, gardener and shopkeeper. Watch them walk to another task, take a break and pause when spoken to. Save/reload during an errand and check position, activity and recent conversation. At evening, follow the route to a home; next morning people return outside.
- In Settings > Local NPC AI, test one installed local model and then disable/disconnect it. Talk must respond immediately in both cases. Model dialogue should concern work and the day, never reveal an unseen hiding district or claim to be investigation evidence.
- Plan journeys with a fast-service, signal-delay and repair-stop label. Compare the displayed ETA with the actual arrival. During repairs, landscape/progress should pause, the remaining stop should be clear and the party must resume and arrive together. Incidents must not trigger extra modal decisions.
- In settled play, identify your role, the next action, Map and Menu without prompting. Open Ask, Notes, settings and saves from their available shortcuts/menu. Compare the compact answer window and hand at ordinary and 140% text sizes.

## Tag feedback checks

- Tag an exposed NPC and one discovered in cover. The contact and caught character must be visible before the score window. Explain who caught whom and why the tag was valid. Verify Continue, Enter, E and controller A skip the presentation.
- Be caught as the human hider. Repeat with reduced motion: retain the caught pose, tag text and marker, with no shake, sprite bounce or moving particles. Check that a timeout never claims TAG.
- Reload the result: scores stay identical and the celebration does not replay. Review survival, bonus and standings in the compact result window, then open How points work.
- Select 1×, 2×, 4× and 8× in the visible clock controls. Check bracket keys and controller Menu speed cycling. At 140% text, verify Map, Sprint/Concealed, the card counter and objective never overlap.
