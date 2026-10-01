// Viv shades at most this many channels at once.
export const MAX_CHANNELS = 6

const FALLBACK_COLORS: [number, number, number][] = [
  [0, 0, 255],
  [0, 255, 0],
  [255, 0, 0],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 0],
]

interface OmeroChannel {
  active?: boolean
  color?: string
  label?: string
  window?: { start?: number; end?: number }
}

export interface Channel {
  index: number
  label: string
  color: [number, number, number]
  visible: boolean
  // undefined when the store carries no display window; the caller derives one from data
  contrastLimits?: [number, number]
}

const hexToRgb = (hex: string): [number, number, number] | undefined => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return undefined
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function channelsFromMetadata(
  omero: { channels?: OmeroChannel[] } | undefined,
  channelCount: number,
): Channel[] {
  const count = Math.min(channelCount, MAX_CHANNELS)
  return Array.from({ length: count }, (_, index) => {
    const c = omero?.channels?.[index]
    const { start, end } = c?.window ?? {}
    return {
      index,
      label: c?.label || `Channel ${index}`,
      color: (c?.color && hexToRgb(c.color)) || FALLBACK_COLORS[index],
      visible: c?.active ?? true,
      contrastLimits:
        typeof start === 'number' && typeof end === 'number' && end > start
          ? [start, end]
          : undefined,
    }
  })
}

// OMERO's rendering defaults name the plane to open on; z=0 is often an empty slice.
export function defaultPlane(
  omero: { rdefs?: { defaultZ?: number; defaultT?: number } } | undefined,
  shape: number[],
  labels: string[],
) {
  const clamp = (axis: string, v?: number) => {
    const i = labels.indexOf(axis)
    return i === -1 || typeof v !== 'number' ? 0 : Math.max(0, Math.min(v, shape[i] - 1))
  }
  return { z: clamp('z', omero?.rdefs?.defaultZ), t: clamp('t', omero?.rdefs?.defaultT) }
}
