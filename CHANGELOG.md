# Changelog — ATLAS ETERNAL: The Living Map

## Guild update — patrons, weapons, voice, and the Architect
- Guild patrons deal the quests: three personas assign the difficulty (safe → S-grade); reply by chip or voice — take, bargain, harder, refuse
- VoiceSystem: SpeechRecognition hears you, patrons answer via speechSynthesis; intent words work fully offline
- Weapon rarity ladder: Normal → Mythic with a 0.1% mythic floor on any roll; quest grade sharpens odds; equipped weapon adds dig power
- XP + levels: digs and quest completions level you; level adds a luck edge
- The Guild Architect: 'Commission the Guild' → an engineer agent plans the world (LLM when a BYOK key is configured, local otherwise) and a laborer agent builds it — playable instantly
- BYOK brain: `?llm=endpoint|key|model` or localStorage — OpenAI-compatible, never committed; everything degrades to the local brain offline
- New map: haven-stead farming homestead (heartlands, 6 dig sites)

## Vertical slice (competition submission)
- Seeded infinite map table — deterministic terrain, ocean/desert/grass/forest/rock/snow
- Hands-first: pinch the champion to carry + travel; drop at the edge to recenter the world
- D–SSSS quest cards (grab + release to accept), treasure X digging, relics, havens, wish pedestal
- Race pick (Human/Dwarf/Elf/Naga/Demon), progression, avatar customization
- Cartographer admin (PIN-gated): biome brush, voxel blocks, export, set-as-home map
- 4 authored maps incl. real + mirrored Earth; local multiplayer presence seam
- Event chimes on digs, wishes, builds, quest accepts, PIN unlocks, journey start
- PWA-installable; GitHub Pages auto-deploy on push

## Fixes shipped after end-to-end audit
- fbm elevation: `×0.5` cap removed — procedural rock and snow were unreachable, the "infinite" world was half-empty
- mapdef: `origin: [0,0]` decoded as missing (falsy fallback) → off-center authored maps
- net: peer leave leaked ECS entities; malformed map-message JSON could crash
- presence: BroadcastChannel/WebSocket sends guarded against teardown-state throws; malformed `?relay=` no longer kills boot
- presence-relay: join/leave sends guard readyState (zombie peers no longer crash the relay)
- tools: starter-map generator now merges `index.json` instead of clobbering other maps; `clear-save` resets all three persisted keys

## Repo / docs
- MIT license, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, README multiplayer + map deep-links + 2D map creator + license attribution
- OG/Twitter cards, noscript + lang, ARIA labels on app + canvas, PWA manifest categories + screenshot
- Site files: robots.txt, sitemap.xml, branded 404, .well-known/security.txt, humans.txt
