# Burpo — Echo Trace

Echo Trace is a borrowed-phone drawing duplication built as a private, offline-ready web app.
The participant draws a simple continuous symbol, completes a short verbal-interference task,
and places their own phone face down. The performer commits to a drawing on paper before the
participant reveals the original on their phone.

The important design choice is that the phone creates the *test*, while the impossible moment
happens physically between the performer’s paper and the participant’s private drawing.

## What is here

- `index.html` — polished participant experience
- `studio.html` — performer training, decoder map, speed drills, and scripting
- `src/trace-engine.js` — on-device trace analysis and phrase engine
- `service-worker.js` — offline app shell after the first visit
- `PERFORMANCE.md` — rehearsal notes and full performance sequence
- `tests/engine.test.mjs` — dependency-free tests for the core method

## Run locally

The project has no build step and no dependencies.

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173/` for participant mode or
`http://localhost:4173/studio.html` for performer mode.

Run the engine checks with:

```bash
node tests/engine.test.mjs
```

## Privacy and performance safety

The drawing is processed in memory in the participant’s browser. It is not uploaded, persisted,
or sent to another device. Closing or refreshing the tab destroys it. The app requests no camera,
microphone, contact, location, or notification permissions.

Use this only as an explicitly invited entertainment experience. Do not represent it as a real
scientific assessment, collect participant data, or deploy a modified version that covertly records
input.

## Deployment

All paths are relative, so the project can be hosted directly from a GitHub Pages project site.
Enable Pages for the repository and choose the `main` branch root as the source.
