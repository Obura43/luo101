# Luo101 Web Deployment

Luo101 is prepared as a single-page Expo web app. A production export is generated into `dist/` and can be deployed to any static host.

## Build

```bash
npm run build:web
```

The generated site lives in:

```text
dist/
```

## Local Production Preview

```bash
npm run serve:web
```

This serves the already-built `dist/` folder so we can check the production bundle before connecting the domain.

## Recommended Hosting Options

### Vercel

Use the included `vercel.json`.

- Build command: `npm run build:web`
- Output directory: `dist`
- Add custom domain: `luo101.org`
- Add `www.luo101.org` as a redirect or alias

### Netlify

Use the included `netlify.toml`.

- Build command: `npm run build:web`
- Publish directory: `dist`
- Add custom domain: `luo101.org`
- Add `www.luo101.org` as a redirect or alias

## DNS Checklist

After choosing a host, update the DNS records where `luo101.org` is managed.

- Apex domain: `luo101.org` should point to the host's required A/ALIAS/ANAME record.
- WWW: `www.luo101.org` should point to the host's required CNAME target.
- Enable HTTPS after DNS verifies.
- Set the preferred canonical domain, usually `https://luo101.org`.

## SEO

The production build runs `scripts/prepare-web-seo.js` after Expo export. It injects title, description, canonical URL, Open Graph, Twitter card tags, `robots.txt`, `sitemap.xml`, and `site.webmanifest` for `https://luo101.org`.

## Pre-Launch Checks

Run these before publishing a public version:

```bash
npm run typecheck
npm run build:web
```

Then verify:

- The Learn page works well on phone and desktop widths.
- Lesson progress persists after refresh.
- Audio buttons still play in the browser.
- Unit 12 search and filters work.
- The page title says `Luo101`.
