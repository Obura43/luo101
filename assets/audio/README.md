# Luo101 Audio Assets

This folder contains human-recorded phrase audio for Luo101.

## Current format

- Container/codec: Ogg Opus
- Channels: mono
- Typical duration: 1-4 seconds
- Folder path used by the app manifest: `assets/audio`

## App integration

The app does not rely on filenames directly. Stable curriculum keys live in `src/data/lessons.ts` as `audioKey` values, and available recordings are mapped in `src/data/audioManifest.ts`.

When adding a new recording:

1. Put the file in this folder.
2. Keep the phrase spoken once, cleanly, with a little natural space before/after.
3. Add or update the matching `audioKey` entry in `src/data/audioManifest.ts`.
4. Prefer Ogg Opus mono for consistency.

## Naming

Human-readable filenames are acceptable, but the manifest is the source of truth. For new batches, prefer lowercase descriptive names, for example:

- `adhi maber.ogg`
- `oyawore mama.ogg`
- `piero ariyo gachiel.ogg`

If fluent-speaker spelling choices change, keep the app key stable and update the manifest label/path deliberately.
