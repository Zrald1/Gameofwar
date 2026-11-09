# Loop Task State

- GOAL: advance ATLAS ETERNAL — map creation, better hand/gesture design, works in VR + desktop, a 3D NPC figure, all lightweight; push every integrated feature
- ITERATION: 3
- LOG:
  - iter1: built createPatron() robed envoy (7 prims, persona robe tints); scene node at table rim; gesture point-dwell + fist-bump verbs; lazy robe rig (clones mount async); pushed ff7a423
  - iter2: PatronTag + patronPressed for desktop click parity; fist-punch=vox-add, palm-swipe=vox-del in edit mode; verified all 4 poses classify in live IWER + a real gesture inked a patron contract; pushed d457af4
- FINDINGS:
  - manifest clones mount AFTER system init — never getObjectByName scene-asset parts in init(); lazy-rig on first visible update frame
  - Vite serves stale transforms on this box — `dev down`/`dev up` needed when module graph desyncs (Anchors empty despite edits on disk)
  - stampVox ops: 'add'|'del'|'clear'; patron world pos ≈ (-0.56,0.85,-0.99); `xr set-device-state {state:{hands:{right:{poseId}}}}` + `xr set-transform {anchor:"index-tip"}` drive emulated hands
  - `__atlas` now exposes Anchors for probes; probe-patron/probe-gesture/probe-summon/probe-offer-state work via browser run
- NEXT: map creation — a third authored map showcasing the patron + voxel ruins (theme: "the Shattered Causeway" or archipelago), generated via tools/make-starter-maps pattern + registered in index.json
- BLOCKERS: none
