# EasyPeasy

A free, open-source Windows study app: **highlight once, use everywhere.** Open a
PDF, highlight the important parts, and each highlight becomes a *card*. In later
phases the same card also shows up as a mind-map node and a spaced-repetition
flashcard.

> Status: **Phase 1** — PDF reader, highlighting, cards, and study sets.

## What works in Phase 1

- **Study sets** — subject folders that group documents (a document can live in
  several sets).
- **PDF reader** — smooth scrolling, zoom, and text selection, powered by pdf.js.
- **Highlighting → cards**
  - Select text to make a **text card**.
  - Toggle **▭ Area** to drag a box over a diagram/formula and make an **image card**.
  - Card creation is a first-time **Allow once / Always allow** prompt, configurable in
    Settings (ask every time / create automatically / only when I click).
- **Card panel** — each card has its text or image, a title, a personal note, free-form
  tags, a color, and a **↩ jump-back** link to the exact spot in the document.

Your data stays on your device in a local SQLite database under
`%APPDATA%\EasyPeasy\`. Original files are never modified — EasyPeasy keeps its own
read-only copy, identified by a content hash, so your notes survive the file being
moved or renamed.

## Tech stack

Electron + React + TypeScript (strict) · electron-vite · Tailwind (light theme) ·
pdf.js · better-sqlite3 (main process) · packaged with electron-builder (NSIS).

## Getting started

```bash
npm install        # installs deps; postinstall rebuilds better-sqlite3 for Electron
npm run dev         # launch the app with hot reload
```

### Build a Windows installer

```bash
npm run dist        # outputs release/EasyPeasy-Setup-<version>.exe (per-user NSIS)
```

## Project layout

```
src/
  main/        # Electron main process: window, SQLite storage, document import, IPC
    storage/   # db connection, migrations, repositories
    documents/ # content hashing + PDF import
    cards/     # area-image file storage
    ipc/       # typed IPC handlers (one per channel)
  preload/     # the single, allow-listed window.api bridge
  renderer/    # React UI
    src/modules/{reader,cards,studysets,settings}
  shared/      # domain types + IPC contract shared by all layers
tests/         # Vitest storage-layer tests
```

## A note on native modules and tests

`better-sqlite3` is a native module, and Electron and Node use different binary
ABIs. The app needs the **Electron** build; the Vitest tests run under **Node**.

- Run the app: `npm run dev` (install already built for Electron).
- Run tests: `npm test` (its `pretest` rebuilds better-sqlite3 for Node first).
- After testing, before running the app again: `npm run rebuild:electron`.

## Security model

Context isolation is on and Node integration is off in the renderer. All database
and file access runs in the main process and is exposed to the UI only through the
typed `window.api` bridge over an allow-listed set of IPC channels.

## License

MIT.
