# Loop Task State

- GOAL: advance ATLAS ETERNAL — map creation, better hand/gesture design, works in VR + desktop, a 3D NPC figure, all lightweight
- ITERATION: 1
- LOG:
  - iter1: recon post-pull — GestureSystem (point/fist/thumbsup/palm verbs) + NPC offer system (3 personas, chips, LLM hook) already merged and wired; gap: NPC has NO 3D figure
- FINDINGS:
  - gesturePress→interact.ts:51, npcReply→hud.ts:289, offer panel at hud.ts:356
  - fist gesture only punches dig-x today — could also place voxel blocks in edit mode (natural verb)
- NEXT: build the 3D patron NPC figure (lightweight procedural, persona-tinted, idle animation, appears at table edge with the offer)
- BLOCKERS: none
