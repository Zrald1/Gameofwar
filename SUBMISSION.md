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
- **Guild patrons deal the quests** — Old Fenwick (safe ledgers), Mira the
  Bold (deep expeditions), Vex of the Ninth Seal (S-grade legend work). The
  patron chooses the difficulty; you answer back: take it, bargain for more
  gold, ask for something harder, or send them away — by chip or by voice.
- **Grab a glowing quest card**, grade D through legendary SSSS, and release
  to accept — treasure hunts, surveys, boss contracts.
- **Carry your champion to the X and press it** to dig up gold, relics, and
  legendary drops — the X refuses if you're not close enough.
- **Weapons drop on a six-tier rarity ladder** — Normal to Mythic with a
  0.1% floor on any roll, so a low-level lucky pull can still change the run;
  quest grade sharpens the odds.
- Level up as you dig and quest; equip the strongest weapon you find.
- Build a **Haven**: houses that generate gold while you roam.
- Whisper a **wish** at the pedestal for a rare boon.
- Everything persists — save, race, map, home — so you return to your world.

**Create your own world:** unlock the Cartographer with an admin PIN, then
paint biomes, roads, dig sites, spawn points — and a Minecraft-style voxel
layer to raise walls, doors, stairs and towers — all with your hands. Save
your creation as the default map everyone lands in, or export/share it.

**The Guild Architect (AI map creator):** press *Commission the Guild* and a
civil-engineer agent drafts the survey — landmass, biome regions, roads, dig
sites, a name and a story — while a laborer agent raises the land under your
eyes. With an OpenAI-compatible endpoint configured (`?llm=` link or local
key, never committed) the engineer drafts from your text prompt; offline, a
seeded local draftsman does the same job. Either way the new world is
playable the instant it lands.

**How it was built:** Immersive Web SDK (IWSDK) + WebXR + Three.js.
Deterministic seeded terrain gives the illusion of an AI-grown infinite
world with zero backend. UIKitML spatial panels, instanced terrain,
procedural quest generation tuned by complexity grade.

**Hands-first by design:** every interaction — carrying, pressing, grabbing,
painting, PIN login — is a pinch or ray, answered with a chime. Seated-friendly
and legible inside a two-foot reach: passes the airplane-seat test, and a full
loop (pick race → travel → quest → dig → build) fits a ten-minute bus stop.

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
Capture the emulated Quest 3 session (production build, `:4173`):
- **0:00–0:15** — world shot + pinch-carry the champion to the map edge; the
  world recenters beneath it. Lead with this.
- **0:15–0:45** — *Commission the Guild*: the engineer plans, the laborer
  raises a world live, and the new map lands on the table playable.
- **0:45–1:15** — a patron offer appears: answer with voice or chips —
  *bargain* for more gold, then *take it*.
- **1:15–2:00** — carry to the X, dig, show the loot roll land a weapon
  (the gear line updates) and the XP level-up.
- **2:00–2:40** — build a Haven house, enter the Cartographer PIN, paint a
  mountain, Set as Home.
- **2:40–3:00** — pull back to the whole table: patron, cards, map, hands.

### Access
IWSDK WebXR build — LIVE at https://zrald1.github.io/Gameofwar/ (auto-deploys on every push).
Repo: https://github.com/Zrald1/Gameofwar
Judges can deep-link straight into each authored world:
?map=atlas-home · ?map=verdant-reach · ?map=old-earth · ?map=terra-mirror · ?map=haven-stead
Optional AI upgrade (bring-your-own-key, stored only in the browser):
?llm=endpoint|key|model — powers LLM-drafted maps and voiced patron replies.
