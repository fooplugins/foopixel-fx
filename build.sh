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

# Progress bars: an optional add-on that plugs into the core. The script-tag build reads
# window.PixelFX (load it after foopixel-fx.js); the ES module imports the core next to it.
cat src/progress/_umd-head.js src/progress/_progress.js src/progress/_umd-tail.js > dist/foopixel-fx-progress.js
cat src/progress/_esm-head.js src/progress/_progress.js src/progress/_esm-tail.js > dist/foopixel-fx-progress.esm.js
npx --yes terser dist/foopixel-fx-progress.js -c -m --comments '/^!/' -o dist/foopixel-fx-progress.min.js
sed 's#"./foopixel-fx.esm.js"#"./foopixel-fx.esm.min.js"#' dist/foopixel-fx-progress.esm.js \
  | npx --yes terser --module -c -m --comments '/^!/' -o dist/foopixel-fx-progress.esm.min.js
cp types/foopixel-fx-progress.d.ts dist/foopixel-fx-progress.d.ts
echo "built: $(ls dist | tr '\n' ' ')"
