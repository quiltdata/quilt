# Manual checks

Checks that need a real browser, so `vitest` cannot run them: jsdom has no
canvas (`getContext('2d')` returns null), and no amount of mocking makes a
pixel assertion meaningful.

## icon-crop-check.html

Exercises `Admin/Buckets/iconCrop.ts` — the crop, the encode, and the JPEG
fallback — against a real canvas, asserting on decoded pixels. Covers what the
unit tests cannot: that the nine `drawImage` arguments are in the right order,
that a crop slid back inside an image edge stays square rather than being
stretched into the square output, that the white fill precedes the redraw in the
JPEG path, and that every encoding the canvas actually produces respects the size
bound.

```sh
npm run check:icon-crop
```

The script compiles the module and then serves this directory, blocking until
interrupted; open the printed URL in another shell. Each check renders as a
`PASS`/`FAIL` line with the value it measured, and the page title reads
`ALL PASS` or `FAILURES`.

A headless run, which is how the results are captured for a pull request:

```sh
npm run check:icon-crop &            # serves on 8099
"$(npx playwright path chromium 2>/dev/null || echo chromium)" \
  --headless --disable-gpu --user-data-dir="$(mktemp -d)" \
  --virtual-time-budget=30000 --dump-dom \
  http://127.0.0.1:8099/icon-crop-check.html
```
