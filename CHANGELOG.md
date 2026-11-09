# Changelog — ATLAS ETERNAL: The Living Map

## Vertical slice (competition submission)
- Seeded infinite map table — deterministic terrain, ocean/desert/grass/forest/rock/snow
- Hands-first: pinch the champion to carry + travel; drop at the edge to recenter the world
- D–SSSS quest cards (grab + release to accept), treasure X digging, relics, havens, wish pedestal
- Race pick (Human/Dwarf/Elf/Naga/Demon), progression, avatar customization
- Cartographer admin (PIN-gated): biome brush, voxel blocks, export, set-as-home map
- 4 authored maps incl. real + mirrored Earth; local multiplayer presence seam
- PWA-installable; GitHub Pages auto-deploy on push

## Fixes shipped after end-to-end audit
- fbm elevation: `×0.5` cap removed — procedural rock and snow were unreachable, the "infinite" world was half-empty
- mapdef: `origin: [0,0]` decoded as missing (falsy fallback) → off-center authored maps
- net: peer leave leaked ECS entities; malformed map-message JSON could crash
- presence: BroadcastChannel/WebSocket sends guarded against teardown-state throws; malformed `?relay=` no longer kills boot
- presence-relay: join/leave sends guard readyState (zombie peers no longer crash the relay)
- tools: starter-map generator now merges `index.json` instead of clobbering other maps; `clear-save` resets all three persisted keys

## Repo / docs
- MIT license, CONTRIBUTING, README multiplayer + license attribution, OG/Twitter cards, noscript + lang, PWA manifest categories + screenshot
