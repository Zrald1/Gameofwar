/**
 * The Guild Architect - the AI map creator.
 *
 * Two agents in one pipe, matching the user's design:
 * - the ENGINEER (a "civil engineer") surveys and directs: it produces a
 *   BuildPlan - landmass shape, biome regions, road spokes, dig sites, the
 *   haven, spawn, name and story. With an LLM configured the plan comes from
 *   the model; without one a seeded local planner draws the same shape.
 * - the LABORER builds: it rasterizes the plan into an `atlas.map.v1` MapDef
 *   and raises the world through the normal map pipeline, so the new land is
 *   instantly playable.
 */
import { decodeMap, applyMap } from './mapdef.js';
import { llmChat } from './brain.js';
import { feed, G } from '../state.js';

export interface BuildPlan {
  name: string;
  story: string;
  w: number;
  h: number;
  /** biome blobs the engineer commissioned: center, radii, tile char, density */
  blobs: { x: number; y: number; rx: number; ry: number; ch: string; dens: number }[];
  /** number of roads radiating from the haven */
  spokes: number;
  /** dig-site count scattered on land */
  digs: number;
}

const VALID_CH = new Set('osdgfrn'.split(''));
const NAMES_A = ['Emberfall', 'Thornmere', 'Goldhollow', 'Ravenspire', 'Duskhaven', 'Stormrest', 'Briarfen', 'Cinderfall'];
const NAMES_B = ['Expanse', 'March', 'Reach', 'Holt', 'Vale', 'Terraces', 'Wilds', 'Barrens'];

/** the engineer's local survey - deterministic from G.rng */
function localPlan(): BuildPlan {
  const w = 64, h = 48;
  const blobs: BuildPlan['blobs'] = [];
  const count = 2 + Math.floor(G.rng() * 3);
  const biomes = ['f', 'r', 'd', 'n'];
  for (let i = 0; i < count; i++) {
    blobs.push({
      x: 12 + Math.floor(G.rng() * (w - 24)),
      y: 10 + Math.floor(G.rng() * (h - 20)),
      rx: 4 + G.rng() * 6,
      ry: 3 + G.rng() * 5,
      ch: biomes[Math.floor(G.rng() * biomes.length)],
      dens: 0.75 + G.rng() * 0.2,
    });
  }
  return {
    name: `${NAMES_A[Math.floor(G.rng() * NAMES_A.length)]} ${NAMES_B[Math.floor(G.rng() * NAMES_B.length)]}`,
    story: 'Raised by the guild laborers - fresh ink, uncharted riches.',
    w, h, blobs,
    spokes: 3 + Math.floor(G.rng() * 3),
    digs: 4 + Math.floor(G.rng() * 4),
  };
}

/** clamp/purify an llm-returned plan into a BuildPlan (never trust the model) */
function sanitize(raw: any): BuildPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const blobs = (Array.isArray(raw.blobs) ? raw.blobs : [])
    .map((b: any) => ({
      x: Math.max(6, Math.min(58, b?.x | 0)),
      y: Math.max(6, Math.min(42, b?.y | 0)),
      rx: Math.max(2, Math.min(12, Number(b?.rx) || 4)),
      ry: Math.max(2, Math.min(10, Number(b?.ry) || 4)),
      ch: VALID_CH.has(b?.ch) ? b.ch : 'f',
      dens: Math.max(0.4, Math.min(1, Number(b?.dens) || 0.8)),
    }))
    .filter((b: any) => b.ch !== 'o')
    .slice(0, 6);
  if (!blobs.length) return null;
  return {
    name: String(raw.name ?? 'Uncharted').slice(0, 40),
    story: String(raw.story ?? '').slice(0, 220),
    w: 64,
    h: 48,
    blobs,
    spokes: Math.max(2, Math.min(6, raw.spokes | 0)),
    digs: Math.max(2, Math.min(8, raw.digs | 0)),
  };
}

/** the engineer directs - LLM plan when the brain is configured, else local */
export async function engineerPlan(prompt?: string): Promise<{ plan: BuildPlan; ai: boolean }> {
  const out = await llmChat([
    {
      role: 'system',
      content:
        'You are the Guild\'s civil engineer, planning a fantasy tabletop world map. ' +
        'Reply with ONLY a JSON object (no prose): {"name": string, "story": string(<=140 chars), ' +
        '"blobs": [{"x":6-58,"y":6-42,"rx":2-12,"ry":2-10,"ch":"f|r|d|n","dens":0.4-1.0}], ' +
        '"spokes": 2-6, "digs": 2-8}. Tile chars: f=forest, r=rock, d=desert, n=snow. ' +
        'The map is a 64x48 grass island surrounded by ocean; blobs carve special regions. ' +
        (prompt ? `The patron asked for: "${prompt}".` : 'Invent an interesting land.'),
    },
    { role: 'user', content: 'Draft the survey plan as JSON.' },
  ], 400);
  if (out) {
    try {
      const m = out.match(/\{[\s\S]*\}/);
      const plan = m ? sanitize(JSON.parse(m[0])) : null;
      if (plan) return { plan, ai: true };
    } catch {
      /* fall through to local */
    }
  }
  return { plan: localPlan(), ai: false };
}

/** the laborer builds - rasterize the plan into atlas.map.v1 JSON -> MapDef */
export function laborerBuild(plan: BuildPlan): ReturnType<typeof decodeMap> {
  const { w, h } = plan;
  const cx = w / 2, cy = h / 2;
  const rng = G.rng;
  const tiles: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / (w * 0.42);
      const dy = (y - cy) / (h * 0.42);
      const edge = 1.0 + Math.sin(x * 0.6) * 0.05 + Math.cos(y * 0.8) * 0.05 + (rng() - 0.5) * 0.08;
      row += dx * dx + dy * dy < edge ? 'g' : 'o';
    }
    tiles.push(row);
  }
  const grid = tiles.map((r) => r.split(''));
  // laborer carves each commissioned region
  for (const b of plan.blobs) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - b.x) / b.rx, dy = (y - b.y) / b.ry;
        if (dx * dx + dy * dy < 1 && rng() < b.dens && grid[y][x] === 'g') grid[y][x] = b.ch;
      }
    }
  }
  // sand ring where land meets sea
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] !== 'o') continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(
        ([dx, dy]) => grid[y + dy]?.[x + dx] && grid[y + dy][x + dx] !== 'o' && grid[y + dy][x + dx] !== 's',
      );
      if (near) grid[y][x] = 's';
    }
  }
  // roads radiate from the haven (center)
  const hx = Math.round(cx), hy = Math.round(cy);
  const roads: [number, number][] = [];
  for (let s = 0; s < plan.spokes; s++) {
    const ang = (s / plan.spokes) * Math.PI * 2 + rng() * 0.4;
    for (let d = 1; d < w; d++) {
      const x = Math.round(hx + Math.cos(ang) * d);
      const y = Math.round(hy + Math.sin(ang) * d);
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) break;
      if (grid[y][x] === 'o') break;
      roads.push([x, y]);
    }
  }
  // dig sites on dry land, spread away from the haven
  const digs: [number, number][] = [];
  for (let t = 0; t < 200 && digs.length < plan.digs; t++) {
    const x = 4 + Math.floor(rng() * (w - 8));
    const y = 4 + Math.floor(rng() * (h - 8));
    if (grid[y][x] !== 'o' && Math.hypot(x - hx, y - hy) > 8 && !digs.some(([a, b]) => Math.hypot(a - x, b - y) < 8)) {
      digs.push([x, y]);
    }
  }
  return decodeMap({
    version: 'atlas.map.v1',
    name: plan.name,
    story: plan.story,
    w, h,
    origin: [-Math.round(cx), -Math.round(cy)],
    champion: [hx, hy + 1],
    haven: [hx, hy],
    tiles: grid.map((r) => r.join('')),
    roads,
    digs,
  });
}

/**
 * Commission the guild: the engineer surveys (LLM when configured), the
 * laborer raises the land, and the world loads it - the player is playing on
 * the AI-authored map immediately.
 */
export async function commissionTheGuild(prompt?: string): Promise<void> {
  feed('The Guild engineer unrolls a blank survey...');
  const { plan, ai } = await engineerPlan(prompt);
  feed(`Engineer's plan: "${plan.name}" ${ai ? '(AI-drafted)' : '(local draftsman)'}.`);
  const def = laborerBuild(plan);
  if (!def) {
    feed('The laborers strike - the plan was unbuildable.');
    return;
  }
  applyMap(def);
  feed(`The laborers finish. Welcome to ${def.name}.`);
}
