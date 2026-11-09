# Contributing

This is a solo competition entry — external contributions aren't expected,
but the repo is public for evaluation. If you're judging/reviewing:

## Run it
```bash
npm install
npm run dev          # IWSDK-managed dev server + emulated Quest browser
npm run typecheck    # TS check before anything else
npm run build        # production bundle -> dist/
npm run preview      # serve the production build locally
```

## The code
- `src/` — game systems (terrain, nav, quests, interact, edit, hud, presence)
- `public/scenes/` — IWSDK scene composition (JSON, no geometry)
- `public/ui/` — UIKitML panels
- `tools/` — dev drivers + map generators + presence relay
- `AGENTS.md` + `public/**/AGENTS.md` — project rules for agent-assisted work

## House rules
- Typecheck clean before any change
- Scene JSON is composition only — geometry/materials live in `src/scene-assets/`
- Keep the seeded world deterministic — no runtime randomness outside `gen/prng.ts`
- MIT license — see [LICENSE](LICENSE)
