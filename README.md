# Luo101

Luo101 is a playful but premium Expo app for learning Dholuo in short, useful lessons.

## Current Prototype

- Mobile-first Expo + React Native app
- Unit 1: `Mos Ber` greetings path
- Interactive multiple-choice and word-building lesson flow
- XP and streak state
- Phrasebook with audio-ready phrase keys
- Profile screen with Supabase backend plan
- Local lesson content in `src/data/lessons.ts`

## Run Locally

```bash
npm run web -- --localhost
```

Then open:

```text
http://localhost:8081
```

If the browser cannot reach `localhost` on Windows, use:

```text
http://[::1]:8081
```

## Verify

```bash
npm run typecheck
```

## Supabase Direction

The first version keeps content local so the lesson model can move fast. Supabase can be added for auth, profiles, progress, mistake reviews, content, and phrase audio storage once the prototype flow feels right.

Planned backend pieces are sketched in `src/lib/supabasePlan.ts`.
