const fs = require('fs');
const path = require('path');

const siteUrl = 'https://luo101.org';
const appName = 'Luo101';
const title = 'Luo101 | Learn Dholuo. Speak it. Pass it on.';
const description = 'Learn Dholuo through playful lessons, audio practice, stories, and an A-Z Luo dictionary built to help preserve and pass on the beauty of Luo language and culture.';
const keywords = 'Luo101, Dholuo, Luo language, learn Dholuo, learn Luo, Luo culture, Kenya languages, African languages, language preservation';
const distDir = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  throw new Error('dist/index.html was not found. Run npm run build:web first.');
}

let html = fs.readFileSync(indexPath, 'utf8');
const seoHead = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="keywords" content="${keywords}" />
    <meta name="application-name" content="${appName}" />
    <meta name="apple-mobile-web-app-title" content="${appName}" />
    <meta name="theme-color" content="#0E6B4F" />
    <link rel="canonical" href="${siteUrl}/" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${appName}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${siteUrl}/" />
    <meta property="og:image" content="${siteUrl}/favicon.ico" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${siteUrl}/favicon.ico" />`;

html = html
  .replace(/<title>.*?<\/title>/s, '')
  .replace(/\s*<meta name="description" content=".*?"\s*\/?>(\r?\n)?/s, '')
  .replace(/\s*<meta name="theme-color" content=".*?"\s*\/?>(\r?\n)?/s, '')
  .replace(/\s*<link rel="manifest" href=".*?"\s*\/?>(\r?\n)?/s, '')
  .replace(/<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" \/>/, '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />' + seoHead);

fs.writeFileSync(indexPath, html);

fs.writeFileSync(path.join(distDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
fs.writeFileSync(path.join(distDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`);
fs.writeFileSync(
  path.join(distDir, 'site.webmanifest'),
  JSON.stringify(
    {
      name: appName,
      short_name: appName,
      description,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#F7FAF6',
      theme_color: '#0E6B4F',
      icons: [
        {
          src: '/favicon.ico',
          sizes: '48x48',
          type: 'image/x-icon',
        },
      ],
    },
    null,
    2,
  ) + '\n',
);

console.log(`SEO files prepared for ${siteUrl}`);
