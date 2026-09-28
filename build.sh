#!/usr/bin/env sh
# Rebuilds dist/ from src/. Requires Node (uses npx terser for the .min files).
set -e
cd "$(dirname "$0")"
cat src/_head.js src/_fx.js src/_burst.js src/_tail.js > src/pixelfx-core.js
{ echo "(function () {"; cat src/pixelfx-core.js; cat src/_auto-init.js; } > dist/foopixel-fx.js
{ cat src/pixelfx-core.js; cat src/_esm-exports.js; } > dist/foopixel-fx.esm.js
npx --yes terser dist/foopixel-fx.js -c -m --comments '/^!/' -o dist/foopixel-fx.min.js
npx --yes terser dist/foopixel-fx.esm.js --module -c -m --comments '/^!/' -o dist/foopixel-fx.esm.min.js
cp types/foopixel-fx.d.ts dist/foopixel-fx.d.ts
echo "built: $(ls dist | tr '\n' ' ')"
