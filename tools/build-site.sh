#!/bin/sh
# Builds site/: the document as a page in its own style, plus the live examples,
# for justaicode.app/classic-1984 (copied there by the justaicode-site repo's
# sync-classic.sh). Needs Node for `npx marked`.
set -e
cd "$(dirname "$0")/.."
rm -rf site && mkdir -p site
cp -R classic-1984.css classic-1984.js specimen.html pictures.html fonts images site/
rm -rf site/fonts/source
body=$(npx -y marked@15 --gfm -i README.md)
cat > site/index.html <<HTML
<!doctype html>
<html lang="en" class="c84">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Classic 1984 — design system</title>
<meta name="description" content="The look of the 1984 Macintosh, rebuilt for modern apps: two colours, Chicago with full Greek, every component, a drop-in stylesheet.">
<link rel="stylesheet" href="classic-1984.css">
<style>
  body { margin: 0; padding: 28px 16px 60px; }
  main { max-width: 900px; margin: 0 auto; padding: 8px 34px 34px; }
  .bar { margin: -8px -34px 24px; }
  h1, h2, h3, h4 { font-family: var(--c84-display); font-weight: normal; line-height: 1.25; }
  h1 { font-size: 30px; margin: 10px 0 12px; }
  h2 { font-size: 22px; margin: 44px 0 12px; padding-bottom: 6px; border-bottom: 2px solid var(--ink); }
  h3 { font-size: 17px; margin: 28px 0 8px; }
  p, li, td, th { font-size: 15px; line-height: 1.6; }
  img { max-width: 100%; outline: 1px solid var(--ink); }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; display: block; overflow-x: auto; }
  th, td { border: 1px solid var(--ink); padding: 5px 8px; text-align: left; vertical-align: top; }
  th { font-family: var(--c84-display); font-weight: normal; background: var(--c84-tint); }
  pre { border: 1px solid var(--ink); box-shadow: var(--c84-shadow); padding: 12px 14px; overflow-x: auto; }
  code { font-size: 0.86em; }
  hr { border: 0; height: 1px; background: var(--c84-dots-h); margin: 30px 0; }
  blockquote { margin: 0; padding-left: 14px; border-left: 3px solid var(--ink); }
  a { word-break: break-word; }
  input[type='checkbox'] { vertical-align: -2px; margin-right: 6px; }
  thead tr:has(th:empty + th:empty) { display: none; }
</style>
</head>
<body class="c84-desktop">
<main class="c84-window">
<div class="c84-window-bar bar"><span class="c84-window-title">Classic 1984</span></div>
$body
</main>
<script type="module">
  import { followSystem } from './classic-1984.js'
  followSystem(document.documentElement, () => ({ hue: 135, strength: 0, night: true }))
</script>
</body>
</html>
HTML
echo "built site/ ($(ls site | wc -l | tr -d ' ') entries)"
