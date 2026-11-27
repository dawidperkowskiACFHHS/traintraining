# Art direction

The game pairs an illustrated indie-adventure interface with colorful pixel towns. Dusk navy plaques, smooth ivory lettering and brass details float over the full-screen world; blue identifies actions and selection. All visible game art is original, authored in this project. No character, logo, map, card image or sprite was imported from a commercial game or a reference repository.

| Axis             | Rule                                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shape            | Broad, stepped roofs; squared windows; round, layered tree crowns; 16-pixel world grid                                                                            |
| Scale            | Travelers use a 24×32 canvas; structures and props use the same 16-pixel tile density; no filtered sprite scaling                                                 |
| Value            | Travelers, open doorways and station signs carry a dark outline or light focal edge; paths are visibly lighter than grass                                         |
| Ground palette   | Sage grass `#a8c67e`, olive shadow `#92b56c`, ochre paths `#ddce9e`                                                                                               |
| Water            | Restrained teal `#72b7bb`, with short pixel wave highlights and visible banks                                                                                     |
| Roofs            | Terracotta `#bc6d53`, teal `#4d9085`, gold `#d4a34f`, slate `#74848c`; consistent roof-tile pitch                                                                 |
| Interface        | Dusk navy `#102634`, ivory `#eff5f5`, blue `#447fd7`, brass `#ecc787`; Atkinson body text, Barlow titles and consistent game borders |
| Travelers        | Human: apricot coat and cap; Mira: teal; Kit: plum; a foot ring and arrow identify the controlled traveler                                                        |
| Cards            | Thick dark outlines, recurring travelers, warm travel-disaster jokes; orange curses, blue/teal tools, purple bonuses; category names and symbols duplicate color  |
| Detail hierarchy | Texture remains quiet on paths; props cluster near markets, gardens, station platforms and landmarks                                                              |
| Lighting         | One restrained daylight palette, short lower/right shadows, no unrelated glow or realistic lighting assets                                                        |
| Motion           | Four directions and alternating step frames; a smooth camera, passing train and soft event ticks; very small card/result camera nudge, removable in Settings      |

Town art lives in `src/art.ts` and is rasterized locally into Phaser textures. Interior roofs are cut away for the occupied building. The same drawing function supplies evidence postcards, preventing invented photo clues. Individual district landmarks have matching original silhouettes: lighthouse, oak, windmill, boathouse, water tower and clock garden.

Geography is organic within the existing pixel style: winding streets, staggered building footprints, rivers with actual bridge crossings, uneven coast/lake edges and seeded vegetation. The region uses irregular settlement clusters, curved railway links and landscape features instead of a cartographic grid. Map labels shift around stations to reduce overlap. These are fictional locations, with the same geography used by questions and travel markers.

Bushes and hedges use the established dark-to-light green ramp and stepped leaf clusters. Crates use the existing ochre wood and dark framing. Their collision/inspection positions come from `Town.cover`, shared by art and rules. Foreground cover occludes the character; a faint local silhouette, foot ring and explicit In cover state keep the controlled traveler readable. Sprint uses quicker walking frames and the existing reduced-motion setting, without additional camera shake.

The customizable traveler extends the existing MIT-licensed original 24×32 sprite through palette swaps and small pixel silhouettes. It offers six skin tones, five hairstyles, six hair colors, eight shirts, six trousers and three accessory states (none, cap, backpack). Keep the same proportions, pixel density, daylight, dark shoes and small foot shadow as the other townspeople. Light eye details retain facial readability across the skin palette. NPC artwork is unchanged. No external sprite pack or new art dependency is required.

`playerCanvas` is the common renderer for gameplay frames, portrait PNGs and the map/replay marker. Four-direction walking previews use an unfiltered 96×128 atlas made from those same frames, displayed at an integer 3× scale. Each facing cycles through idle, left step, idle and right step. The editor preview is a draft; only Save appearance updates the applied traveler. Its compact selectors and cobalt focus styling follow the existing game menus. Selected colors include a name and swatch.

The 24 current card illustrations in `public/art/cards` use original anime/manga travelers, expressive linework, cel shading and travel-disaster jokes. Finished WebP assets total about 2.65 MB. The original prompt set is retained in `docs/art-prompts.json`; archived PNG masters are in `artifacts/source-art`. The title illustration belongs to the same cast and palette. No existing franchise characters, card frames or logos are used.

Visual review uses actual browser screenshots at 1280×800, 1366×768 and 1440×900, with additional gameplay captures at 1440×1000. The world fills the viewport; compact floating controls and the hand overlay it. The tray folds away during travel so the traveler and moving scenery remain visible. Text scaling affects card widths and copy as well as notebook and body text. A color is never the sole indicator of a role, category, exclusion, selected cost or status. Tile collision, doorway appearance and visible blocking silhouettes must agree. The complete interface contract is in `DESIGN.md`.

## Environmental occlusion and travel

Buildings and trees have depth-sorted foreground layers, so the traveler can pass behind them. World signs use high-resolution smooth text above the pixel-art terrain. Cover recognition includes walkable space beside physical walls, trees, crates and substantial street furniture. Public patrol probes derive from town geometry, never a secret hider position.

`journey-scene.ts` draws distinct train, bus, ferry and walking scenes from the current timetable leg. Window scenery has layered parallax; train luggage racks, handholds, bus dashboard and wheel, seating and reflections establish the vehicle. The customized traveler and any companions on the same service appear inside. Animation uses authoritative game time and respects pause and reduced motion.

The distilled interface keeps only navigation and immediate gameplay controls over the world. Native settings sections and a small field-tools drawer replace always-visible secondary controls. Transit uses one destination plaque. The soundscape is synthesized locally from original tones and seeded noise; music, effects and ambience remain independent of the simulation RNG and respect user volume/mute preferences.
