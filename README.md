# ATLAS ETERNAL — The Living Map

A hands-first fantasy diorama for the Meta VR Start Developer Competition 2026.
Sit before a living map table where an infinite, seeded world renders as a
miniature — oceans, deserts, forests, snow peaks — and play the last
Cartographer's heir entirely with your hands.

**Play it live:** https://zrald1.github.io/Gameofwar/

## The game
- Pick a race (Human, Dwarf, Elf, Naga, Demon) — each with its own perk
- Pinch the champion meeple and carry it across tiles to travel; drop it at
  the map's edge and the infinite world recenters beneath it
- Grab glowing quest cards graded D through legendary SSSS and release to accept
- Carry your champion to the X and press it to dig gold, relics, and legendaries
- Build a Haven of income-generating houses; whisper wishes at the pedestal
- Everything persists — race, gold, map, home

## Author your own world
Unlock the Cartographer with an admin PIN, then paint biomes, roads, dig sites,
spawn points — plus a Minecraft-style voxel layer for walls, doors, stairs,
towers — all with your hands. Save it as the default map everyone lands in.

## Stack
Immersive Web SDK (IWSDK) + WebXR + Three.js. Deterministic seeded terrain
(zero backend), UIKitML spatial panels, instanced terrain, procedural quests.
Hands-first: every interaction is a pinch or a ray.

## Repo
- `src/` — game systems (terrain, nav, quests, interact, edit, hud, presence)
- `public/scenes/` — scene composition
- `public/ui/` — UIKitML panels
- `public/maps/` — charted world definitions
- `SUBMISSION.md` / `NEXT_STEPS.md` — Devpost package + remaining steps

## Multiplayer (optional)
Same-table presence works with zero backend: open the app in two browser
windows (or two Quests on the same network) and you share the table.
`?room=name` joins a separate room; `?relay=ws://host:8787` routes presence
through `tools/presence-relay.mjs` for cross-network play.

## License
MIT — see [LICENSE](LICENSE). The `old-earth`/`terra-mirror` maps use
public-domain [Natural Earth](https://www.naturalearthdata.com) country data.
