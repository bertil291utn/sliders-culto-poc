# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # dev server at localhost:5173
npm run build    # production build
npm run preview  # serve the production build
```

## Architecture

This is a **church worship presentation PoC** — 100% frontend, no backend. Three main workflows: (1) song library, (2) culto builder, (3) live presentation.

### Data layer (`src/db/`)

- `database.js` — singleton sql.js instance. All CRUD is synchronous after `initDB()` resolves. DB binary is persisted to `localStorage` on every write via `saveToStorage()`.
- `schema.js` — DDL string run on `initDB()` with `IF NOT EXISTS` guards.
- `useDB.js` hook — returns `true` once the WASM is loaded. `App.jsx` gates all routes behind this.

### Cross-window sync (`src/hooks/useBroadcast.js`)

The operator page and projection page communicate via the **BroadcastChannel API** on channel `"culto-presentation"`. The operator sends a single `STATE` message type on every state change (slot index, line index, lines array, bg color, etc.). The projection page is purely reactive — it renders whatever the last `STATE` message contained.

Presenter mode opens `/projection` via [`src/utils/screenManager.js`](src/utils/screenManager.js): Chromium's **Window Management API** caches `getScreenDetails()` (primed on operator mount via `primeScreenManagement`). With permission + two displays, `window.open` uses **projector bounds** (popup + `left`/`top`/`width`/`height`) and `moveTo`/`resizeTo` as backup; `fullscreen` is not set on `open` (Chrome may ignore coords). Window name: `culto-projection`. Production deploys need **HTTPS** for that API (localhost is fine for dev).

### Routes

| Path | Page | Notes |
|---|---|---|
| `/library` | `LibraryPage` | Song CRUD + karaoke preview |
| `/builder` | `BuilderPage` | Culto + slot management with drag & drop |
| `/operator` | `OperatorPage` | Transport controls + slot nav + tempo |
| `/projection` | `ProjectionPage` | Fullscreen output, no nav bar |

`/projection` is excluded from the nav layout in `App.jsx` via a top-level `<Route>` before the `*` catch-all.

### Slot types

`song` · `reading` · `message` · `no_digital` — enforced by a SQLite CHECK constraint. `ProjectionPage` switches display component based on `slot.type`.

### sql.js WASM loading

`vite.config.js` excludes `sql.js` from Vite's dependency pre-bundling (`optimizeDeps.exclude`). The WASM file is fetched from `https://sql.js.org/dist/` at runtime (requires internet on first load; cached by browser after).
