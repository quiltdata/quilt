import type { Area } from 'react-easy-crop'

// No React, MUI or catalog-config imports in this module: the canvas path cannot
// be exercised under jsdom (getContext('2d') returns null), so it is kept
// bundleable on its own for a real-browser check.

// The disc renders at 32px (44px on the Home cards), so 96px covers 2x of the
// largest slot. Anything bigger just pays bytes in every `buckets` query.
export const ICON_SIZE = 96

// A cropped icon is stored inline as a `data:` URI in BucketConfig.iconUrl, which
// every catalog surface reads on load. PNG keeps alpha and stays well under this
// for flat artwork; photographic crops overshoot it and fall back to JPEG.
export const MAX_ICON_DATA_URL_LENGTH = 16 * 1024

/**
 * Clamp a crop rectangle into the source image's real pixel bounds.
 *
 * react-easy-crop reports `croppedAreaPixels` from floating-point gesture state,
 * so a crop panned to the edge can land a pixel outside the image (negative
 * origin, or width past naturalWidth). `drawImage` reads those as transparent,
 * putting a hairline of nothing along one edge of the disc. Returns null when
 * nothing usable is left, so the caller reports a failure rather than encoding a
 * blank canvas.
 */
export function clampArea(
  area: Area,
  media: { width: number; height: number },
): Area | null {
  if (media.width <= 0 || media.height <= 0) return null
  const x = Math.max(0, Math.min(Math.round(area.x), media.width))
  const y = Math.max(0, Math.min(Math.round(area.y), media.height))
  const width = Math.min(Math.round(area.width), media.width - x)
  const height = Math.min(Math.round(area.height), media.height - y)
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

/**
 * First candidate encoding that fits `budget`, else the smallest one offered.
 *
 * Candidates are ordered best-fidelity-first (PNG, then JPEG at falling
 * quality). At 96px the last candidate always fits in practice; returning the
 * smallest rather than failing keeps a pathological source from blocking a save
 * outright.
 */
export function pickUnderBudget(
  candidates: readonly (() => string)[],
  budget: number,
): string | null {
  let smallest: string | null = null
  for (const encode of candidates) {
    const out = encode()
    if (!out) continue
    if (out.length <= budget) return out
    if (smallest === null || out.length < smallest.length) smallest = out
  }
  return smallest
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

  const out = pickUnderBudget(
    [() => png, asJpeg(0.82), asJpeg(0.6)],
    MAX_ICON_DATA_URL_LENGTH,
  )
  if (!out) throw new Error('Could not encode image')
  return out
}
