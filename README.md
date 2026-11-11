# ATLAS ETERNAL — The Living Map

[![Deploy](https://github.com/Zrald1/Gameofwar/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/Zrald1/Gameofwar/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Live](https://img.shields.io/badge/Live-zrald1.github.io%2FGameofwar-5b8cff)](https://zrald1.github.io/Gameofwar/)

A hands-first fantasy diorama for the Meta VR Start Developer Competition 2026.
Sit before a living map table where an infinite, seeded world renders as a
miniature — oceans, deserts, forests, snow peaks — and play the last
Cartographer's heir entirely with your hands. Then **press V and step into
the map** — the table swells twenty-fold, tiles become real ground under
your feet, and the adventure becomes a walkable world you roam with the
thumbstick, weapon in fist.

**Play it live:** https://zrald1.github.io/Gameofwar/

## The game
- **Morvane, Keeper of the Fold** — the blue wizard at the map's rim greets
  you, asks who you want to be (**answer him by voice** — "an elf..." — or
  tap a race), walks first-timers through a guided lesson, and answers any
  poke with the one tip that matters now. He **notices your deeds** — first
  dig, inked contract, level-up, legendary drop, world-fold — and mutters
  observations in quiet stretches, his staff-star pulsing while he speaks.
  **Hold your fist on him** (or press `T` on desktop) to hear the lesson
  again; **free speech with no contract on the table reaches him too**
- Pick a race (Human, Dwarf, Elf, Naga, Demon) — each with its own perk and
  its own **birthright weapon** riding your right fist in adventure mode
  (squire's sword, delver's hammer, living branch, tide trident, ember claw)
- **Step Into the Map** (`V` or the HUD button): the diorama scales ×20 —
  5 cm tiles become 1 m ground, the rim NPCs stand ~1.9 m tall beside you,
  and thumbstick locomotion walks the endless fold (it recenters beneath
  your feet at every rim)
- **Skills grow from what you do** — six effort tracks (walk, dig, punch,
  quest, talk, wish) ripen into named talents at seeded thresholds, woven
  from your bloodline: an Elf who punches wakes *Sylph Knuckle-Oath*; a
  Dwarf who digs wakes *Deepforge Delver-Hand*. Each grants a real passive
- **A fold-map rides your view top-right** — live biome ink, red Xs on dig
  sites, cyan diamonds on survey targets, gold house on the haven, violet
  P / blue W on the talkable patrons — with labeled edge arrows pointing
  at every off-screen mission
- Pinch the champion meeple and carry it across tiles to travel; drop it at
  the map's edge and the infinite world recenters beneath it
- Guild patrons deal the quests — three personas choose the difficulty;
  answer with take / bargain / harder / refuse chips, or **talk to them**
- Weapons drop on a six-tier rarity ladder — Mythic sits at a 0.1% floor on
  any roll, and quest grade sharpens the odds
- Level up as you dig and quest; equip the strongest weapon you find
- Hands are verbs: **point** at the X to dwell-press it, **punch** it with a
  fist, and answer patrons with a **thumbs-up** or an **open palm**
- Carry your champion to the X and press it to dig gold, relics, and legendaries
- Build a Haven of income-generating houses; whisper wishes at the pedestal
- Event chimes answer every satisfying moment — digs, wishes, builds, unlocks
- Everything persists — race, gold, level, arsenal, map, home

## Author your own world
Unlock the Cartographer with an admin PIN, then paint biomes, roads, dig sites,
spawn points — plus a Minecraft-style voxel layer for walls, doors, stairs,
towers — all with your hands. Save it as the default map everyone lands in.

Or let the **Guild Architect** do it: *Commission the Guild* sends an engineer
to plan a world and a laborer to raise it — playable instantly, offline or
LLM-drafted from your prompt with a bring-your-own key (`?llm=` link).

## Run it locally
```bash
npm install
npm run dev          # dev server + emulated XR browser → https://localhost:8081/
```
Production build (what judges get):
```bash
npm run build && npm run preview   # → https://localhost:4173/
```
On a Quest: open `https://<your-LAN-IP>:8081/` in the headset browser
(same Wi-Fi, accept the dev certificate).

## Stack
Immersive Web SDK (IWSDK) + WebXR + Three.js. Deterministic seeded terrain
(zero backend), UIKitML spatial panels, instanced terrain, procedural quests.
Hands-first: every interaction is a pinch or a ray.

**Deep-link a world:** `?map=atlas-home` | `verdant-reach` | `old-earth` |
`terra-mirror` — jump straight into a specific charted world.

**2D map creator:** open `map-editor.html` on the same host — a flat editor
for painting biomes/roads and exporting world JSON (how the bundled maps
were authored).

## Repo
- `src/` — game systems (terrain, nav, quests, interact, edit, hud, presence)
- `public/scenes/` — scene composition
- `public/ui/` — UIKitML panels
- `public/maps/` — charted world definitions
- `SUBMISSION.md` / `NEXT_STEPS.md` — Devpost package + remaining steps
- `docs/screenshots/` — storyboard stills for the demo video

## Multiplayer (optional)
Same-table presence works with zero backend: open the app in two browser
windows (or two Quests on the same network) and you share the table.
`?room=name` joins a separate room; `?relay=ws://host:8787` routes presence
through `tools/presence-relay.mjs` for cross-network play.

## License
MIT — see [LICENSE](LICENSE). The `old-earth`/`terra-mirror` maps use
public-domain [Natural Earth](https://www.naturalearthdata.com) country data.
