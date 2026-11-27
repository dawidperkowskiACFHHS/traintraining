# Third-party notices

## Bundled runtime components

| Component           | Author                                                       | Source                                  | License | Local changes                             |
| ------------------- | ------------------------------------------------------------ | --------------------------------------- | ------- | ----------------------------------------- |
| Phaser 4.2.1        | Richard Davey / Phaser Studio Inc. and upstream contributors | https://github.com/phaserjs/phaser      | MIT     | None; pinned npm release, bundled by Vite |
| EventEmitter3 5.0.4 | Arnout Kazemier and contributors                             | https://github.com/primus/eventemitter3 | MIT     | None; Phaser dependency                   |

Full upstream license texts are retained in `public/licenses/` and are copied into the production build. Upstream legal comments in the engine distribution are preserved by the build tooling.

## Original assets

The town renderer, maps and neighborhood modules, traveler sprites, station and transport graphics, interface icons, favicon, dialogue, rules implementation and all 24 card illustrations were created specifically for this project. They are provided under the root MIT license. The current original illustrations are bundled as WebP in `public/art`; their prompt set is retained in `docs/art-prompts.json`. Earlier original SVG illustrations remain in `public/cards`. Pixel textures are generated entirely from the bundled `src/art.ts` source, without runtime downloads. Barlow Condensed Bold and Atkinson Hyperlegible Next are bundled under the SIL Open Font License 1.1. Their full upstream licenses are retained in `public/fonts/Barlow-OFL.txt` and `public/fonts/Atkinson-OFL.txt`. Font sources: https://github.com/google/fonts/tree/main/ofl/barlowcondensed and https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegiblenext.

Character customization reuses and extends those original MIT-licensed traveler sprites with palette swaps, hairstyles, a cap and a backpack. Its walking previews, portraits and map markers are generated from the same bundled renderer. No additional third-party sprite assets are incorporated.

## Optional local inference

Optional NPC inference connects to a separately installed Ollama server. No Ollama runtime or model weights are bundled or downloaded by the game. Installed models retain their own licenses and terms.

## Development dependencies

Vite, Vitest and Prettier are MIT-licensed; TypeScript and Playwright use Apache-2.0; Node type declarations use MIT. Their sources and exact transitive releases are identified by the npm lockfile, and their license texts remain in their installed packages. They are development tools, not additional shipped gameplay engines or services.

## References without copied material

RPGJS, Tuxemon, the community question/map projects, Yuka, Tiled, LDtk, MapGenerator, WFC, ngraph.path, Superpowers asset packs, Ninja Adventure, AI Town and Ollama were investigated as documented in `docs/RESEARCH.md`. No source, map, sprite, card art, character, sound or logo from those repositories was incorporated. In particular, no GPL Tuxemon code/maps/assets or LGPL MapGenerator code was copied. No Nintendo or television-production branding, artwork or map was used.

## Original audio and local launcher

The synthesized score, sound effects and ambience in `src/audio.ts`, and the loopback-only Windows launcher in `release/windows/Launcher.cs`, are original project code under the root MIT license. No third-party music recordings, sound samples, browser binary, inference runtime or model weights are bundled. The Windows launcher uses the installed Microsoft Edge and .NET Framework runtimes; their upstream licenses remain separate.

## Pixelify Sans

Copyright 2021 The Pixelify Sans Project Authors (https://github.com/eifetx/Pixelify-Sans). SIL Open Font License 1.1. The unmodified font is bundled locally; see public/fonts/Pixelify-OFL.txt. Source: https://github.com/google/fonts/tree/main/ofl/pixelifysans.
