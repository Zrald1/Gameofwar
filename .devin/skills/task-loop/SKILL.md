---
name: task-loop
description: Work through .devin/task-loop.json — pick pending tasks, complete them toward the goal, and keep the ledger updated until pending is empty or everything left is blocked.
triggers:
  - user
---

# Task Loop

State file: `.devin/task-loop.json` at the repo root:

```json
{
  "enabled": true,
  "goal": "<the objective the loop is working toward>",
  "pending": ["task not yet done — may carry a CAPS status prefix, e.g. 'RUNNING (bg <id>):'"],
  "done": ["completed entries: original task text + ' — DONE: <outcome>'"]
}
```

## Protocol

1. Read `.devin/task-loop.json`. If missing or `"enabled": false`, report the loop is off and stop.
2. If `pending` is empty, report all tasks done and summarize progress toward `goal`. Stop — do not invent new work unless the user asks.
3. Take the FIRST item in `pending` (order is priority). Restate it as the active task.
4. Work the task to completion in this session:
   - A `RUNNING (bg <id>)` prefix means a background job is in flight — collect its output first, then do the task's own work.
   - Stay strictly on the task — no drive-by refactors or unlisted work.
5. When the task is done, update the JSON immediately:
   - Remove the item from `pending`.
   - Append it to `done`, preserving the original text and appending ` — DONE: <one-line outcome with concrete numbers/results>`.
   - If new follow-up work emerged, append entries to the END of `pending`.
   - Keep valid JSON and the same key order: `enabled`, `goal`, `pending`, `done`.
6. If the task is blocked (missing dependency, needs a decision, external state), keep it in `pending`, say `BLOCKED: <reason>`, and move to the next unblocked pending item — or stop if none are unblocked.
7. Repeat from step 2 until `pending` is empty or every remaining item is blocked.

## Rules

- The `goal` field is the north star: judge task outcomes against it. Rewrite `goal` only if the user says so.
- Update `task-loop.json` immediately after each task — never batch several tasks before saving.
- `done` entries are the changelog: one line, concrete, with numbers.
- If `goal` is met before `pending` drains, say so and let the user decide whether to clear the rest.
