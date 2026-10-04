#!/bin/sh
# Renders tools/samples.html into images/samples/ with headless Chrome.
# Needs a static server on the repo root: python3 -m http.server 5288
set -e
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
shot() { "$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size="$2" --screenshot="$3" "http://localhost:5288/tools/samples.html?n=$1" >/dev/null 2>&1; }
for i in 1 2 3 4 5 6; do shot "$i" 240,240 "images/samples/person-$i.png"; done
shot scene 480,320 images/samples/scene.png
