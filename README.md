# Luo101

Luo101 is a playful but premium Expo app for learning Dholuo. Learn Dholuo. Speak it. Pass it on. The project treats language learning as preservation: a way to keep Luo words, stories, humor, family language, and cultural memory alive for the next generation.

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

## Public Positioning

Tagline: `Learn Dholuo. Speak it. Pass it on.`

The web version should present Luo101 as both a learning tool and a cultural preservation project for the beautiful Luo language.

## Verify

```bash
npm run typecheck
```

## Web Deployment

Luo101 is ready to export as a single-page web app for `luo101.org`.

```bash
npm run typecheck
npm run build:web
```

The production site is generated in `dist/`. Deployment notes for Vercel, Netlify, DNS, HTTPS, and pre-launch checks are in `WEB_DEPLOYMENT.md`.

## Supabase Direction

The first version keeps content local so the lesson model can move fast. Supabase can be added for auth, profiles, progress, mistake reviews, content, and phrase audio storage once the prototype flow feels right.

Planned backend pieces are sketched in `src/lib/supabasePlan.ts`.
