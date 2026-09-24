# Manual checks

Checks that need a real browser, so `vitest` cannot run them: jsdom has no
canvas (`getContext('2d')` returns null), and no amount of mocking makes a
pixel assertion meaningful.

## icon-crop-check.html

Exercises `Admin/Buckets/iconCrop.ts` — the crop, the encode, and the JPEG
fallback — against a real canvas, asserting on decoded pixels. Covers what the
unit tests cannot: that the nine `drawImage` arguments are in the right order,
that a crop clamped at an image edge stays square rather than being stretched
into the square output, that the white fill precedes the redraw in the JPEG
path, and that every encoding the canvas actually produces respects the size
bound.

```sh
npm run check:icon-crop
```

Then open the printed URL. Each check prints pass or fail with the value it
measured; the page title reads `ALL PASS` or `FAILURES`.
