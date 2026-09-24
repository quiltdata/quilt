import type { Area } from 'react-easy-crop'

// No React, MUI or catalog-config imports in this module, so it compiles on its
// own for the real-browser check at internals/manual/icon-crop-check.html
// (`npm run check:icon-crop`) — which is where the canvas path is verified,
// jsdom having no canvas for the unit tests to use.

// The disc renders at 32px (44px on the Home cards), so 96px covers 2x of the
// largest slot. Anything bigger just pays bytes in every `buckets` query.
export const ICON_SIZE = 96

// A cropped icon is stored inline as a `data:` URI in BucketConfig.iconUrl, which
// every catalog surface reads on load. PNG keeps alpha and stays well under this
// for flat artwork; photographic crops overshoot it and fall back to JPEG.
export const MAX_ICON_DATA_URL_LENGTH = 16 * 1024

// Decode costs pixels * 4 bytes regardless of file size, so flat artwork can pass
// a byte cap and still exhaust memory: 30000x30000 of one colour is a few hundred
// KB compressed and ~3.6GB decoded.
export const MAX_SOURCE_PIXELS = 64 * 1000 * 1000

export function fitsPixelBudget(media: { width: number; height: number }): boolean {
  return media.width * media.height <= MAX_SOURCE_PIXELS
}

/**
 * Decode `src` far enough to read its dimensions and report whether it is within
 * the pixel budget.
 *
 * The caller screens a file here, before the cropper renders it: an `<img>` the
 * cropper mounts decodes the whole bitmap, so a guard downstream of that would
 * run after the memory was already spent.
 */
export async function probeWithinPixelBudget(src: string): Promise<boolean> {
  const img = await loadImage(src)
  return fitsPixelBudget({ width: img.naturalWidth, height: img.naturalHeight })
}

/**
 * Clamp a crop rectangle into the source image's real pixel bounds, keeping it
 * square.
 *
 * Outside the bounds `drawImage` reads transparent, leaving a hairline along the
 * disc's edge; and the caller draws into a fixed square, so trimming the axes
 * independently would hand it a non-square rect to stretch. An out-of-bounds
 * square is therefore slid back inside rather than trimmed — trimming shrinks the
 * region, which the fixed-size output then upscales — and the side shrinks only
 * when the image is smaller than the crop. Null when nothing usable is left.
 */
export function clampArea(
  area: Area,
  media: { width: number; height: number },
): Area | null {
  if (media.width <= 0 || media.height <= 0) return null
  const side = Math.min(
    Math.round(area.width),
    Math.round(area.height),
    media.width,
    media.height,
  )
  if (side <= 0) return null
  const x = Math.max(0, Math.min(Math.round(area.x), media.width - side))
  const y = Math.max(0, Math.min(Math.round(area.y), media.height - side))
  return { x, y, width: side, height: side }
}

/**
 * First candidate encoding that fits `budget`, or null when none does.
 *
 * Candidates are ordered best-fidelity-first (PNG, then JPEG at falling
 * quality). The budget is a bound rather than a preference: the icon is read for
 * every bucket at once on the volumes landing, so returning an oversized
 * encoding would defeat the reason the bound exists. A source that cannot be
 * compressed under it is refused, and the admin is told to pick another image.
 */
export function pickUnderBudget(
  candidates: readonly (() => string)[],
  budget: number,
): string | null {
  for (const encode of candidates) {
    const out = encode()
    if (out && out.length <= budget) return out
  }
  return null
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', () => reject(new Error('Could not decode image')))
    img.src = src
  })
}

/**
 * Render the selected crop to a square `data:` URI at ICON_SIZE.
 *
 * JPEG composites the transparent ground to white, so it is only reached when
 * PNG overshoots the budget -- a photographic crop, which has no alpha to lose.
 */
export async function cropToDataUrl(src: string, area: Area): Promise<string> {
  const img = await loadImage(src)
  if (!fitsPixelBudget({ width: img.naturalWidth, height: img.naturalHeight })) {
    throw new Error('This image has too many pixels to crop — try a smaller one')
  }
  const clamped = clampArea(area, {
    width: img.naturalWidth,
    height: img.naturalHeight,
  })
  if (!clamped) throw new Error('Nothing to crop')

  const canvas = document.createElement('canvas')
  canvas.width = ICON_SIZE
  canvas.height = ICON_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not render image')

  const draw = () =>
    ctx.drawImage(
      img,
      clamped.x,
      clamped.y,
      clamped.width,
      clamped.height,
      0,
      0,
      ICON_SIZE,
      ICON_SIZE,
    )

  draw()
  const png = canvas.toDataURL('image/png')

  const asJpeg = (quality: number) => () => {
    ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ICON_SIZE, ICON_SIZE)
    draw()
    return canvas.toDataURL('image/jpeg', quality)
  }

  // PNG is already encoded rather than encoded on demand like the JPEGs: they
  // composite white into this same canvas, so a lazy PNG candidate would read
  // whatever a preceding one left behind and flatten its alpha.
  const out = pickUnderBudget(
    [() => png, asJpeg(0.82), asJpeg(0.6), asJpeg(0.4)],
    MAX_ICON_DATA_URL_LENGTH,
  )
  if (!out) {
    throw new Error('This image is too detailed to store as an icon — try a simpler one')
  }
  return out
}
