# Security Policy

This is a client-only WebXR game — no backend, no user data leaves the
device (localStorage save/preference keys only; optional same-network
presence via WebSocket).

## Reporting a vulnerability
Open a GitHub issue at https://github.com/Zrald1/Gameofwar/issues — no
formal SLA; this is a competition project.

## Scope notes
- `tools/presence-relay.mjs` is an optional dev relay — it forwards
  messages verbatim with no auth or validation. Don't expose it publicly.
- The Cartographer PIN is a convenience gate, not security — it's
  client-side by design.
