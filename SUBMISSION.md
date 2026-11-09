# ATLAS ETERNAL — The Living Map
## Devpost Submission Package — Meta VR Start Developer Competition 2026

**Submission name:** ATLAS ETERNAL: The Living Map
**Track:** Gaming
**Division:** New Experience
**Target date:** Competition window, Nov 2026

---

### Tagline (≤140 chars)
Sit before a living map table. Carry your champion, dig the X, take graded
quests, and forge your own world in a hand-built fantasy diorama.

### Description (≤500 words)
ATLAS ETERNAL turns your tabletop into a breathing fantasy world. A floating
map table renders an infinite, seeded landscape — oceans, deserts, forests,
snow peaks — as a miniature diorama you lean over like a war-room general.

**The fantasy:** you're the last Cartographer's heir. The map is a living
artifact; its ink moves, quests spawn on glowing cards, and somewhere a red X
marks buried treasure.

**Core loop (all hands-first, no controllers needed):**
- Pick a race — Human, Dwarf, Elf, Naga, Demon — each with its own perk.
- **Pinch the champion meeple and carry it** to any tile to travel; drop it
  near the table's edge and the infinite world recenters beneath it.
- **Grab a glowing quest card**, grade D through legendary SSSS, and release
  to accept — treasure hunts, surveys, boss contracts.
- **Carry your champion to the X and press it** to dig up gold, relics, and
  legendary drops — the X refuses if you're not close enough.
- Build a **Haven**: houses that generate gold while you roam.
- Whisper a **wish** at the pedestal for a rare boon.
- Everything persists — save, race, map, home — so you return to your world.

**Create your own world:** unlock the Cartographer with an admin PIN, then
paint biomes, roads, dig sites, spawn points — and a Minecraft-style voxel
layer to raise walls, doors, stairs and towers — all with your hands. Save
your creation as the default map everyone lands in, or export/share it.

**How it was built:** Immersive Web SDK (IWSDK) + WebXR + Three.js.
Deterministic seeded terrain gives the illusion of an AI-grown infinite
world with zero backend. UIKitML spatial panels, instanced terrain,
procedural quest generation tuned by complexity grade.

**Hands-first by design:** every interaction — carrying, pressing, grabbing,
painting, PIN login — is a pinch or ray. Seated-friendly and legible inside
a two-foot reach: passes the airplane-seat test, and a full loop
(pick race → travel → quest → dig → build) fits a ten-minute bus stop.

**Future plans:** real multiplayer presence (the seam is in), on-device
procedural quest AI, more biomes/civilizations, and a full Horizon Store
release.

---

### How hand interactions are implemented (optional field)
Hands-only from boot: pinch-to-grab the champion, quest cards, and treasure
scroll; ray-press dig sites, the wish pedestal, and all UIKitML panels;
a tap-driven PIN pad for the Cartographer admin login; and the whole
Cartographer toolset (biome brush, voxel blocks, export) driven by grab +
press. No controller is ever required.

### Demo video plan (≤3 min)
Capture the emulated Quest 3 session: race pick → carry champion to the map
edge → world recenters → accept a D quest → carry to the X → dig loot →
haven build → open Cartographer PIN → paint a mountain → Set as Home.
Lead with the world-shot + champion carry in the first 15 seconds.

### Access
IWSDK WebXR build — LIVE at https://zrald1.github.io/Gameofwar/ (auto-deploys on every push).
Repo: https://github.com/Zrald1/Gameofwar
Judges can deep-link straight into each authored world:
?map=atlas-home · ?map=verdant-reach · ?map=old-earth · ?map=terra-mirror
