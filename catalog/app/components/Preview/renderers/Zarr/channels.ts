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

export const validLimits = (start?: number, end?: number): [number, number] | undefined =>
  typeof start === 'number' && typeof end === 'number' && end > start
    ? [start, end]
    : undefined

export function channelsFromMetadata(
  omero: { channels?: OmeroChannel[] } | undefined,
  channelCount: number,
): Channel[] {
  const all = Array.from({ length: channelCount }, (_, index): Channel => {
    const c = omero?.channels?.[index]
    return {
      index,
      label: c?.label || `Channel ${index}`,
      color:
        (c?.color && hexToRgb(c.color)) ||
        FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      visible: c?.active ?? true,
      contrastLimits: validLimits(c?.window?.start, c?.window?.end),
    }
  })
  // Active channels first, so a store whose first channels are switched off still opens lit.
  const picked = [...all.filter((c) => c.visible), ...all.filter((c) => !c.visible)]
  return picked.slice(0, MAX_CHANNELS).sort((a, b) => a.index - b.index)
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

type Selection = Record<string, number>

interface Level {
  labels: readonly string[]
  shape: number[]
  getTile(p: any): Promise<unknown>
  getRaster(p: any): Promise<unknown>
}

// Viv applies one selection to every level, so a level that also downsamples z or t
// needs the full-resolution index scaled onto its own extent.
export function onBaseGrid<L extends Level>(level: L, base: Level): L {
  const scale = (selection: Selection) =>
    Object.fromEntries(
      Object.entries(selection).map(([k, v]) => {
        const li = level.labels.indexOf(k)
        const bi = base.labels.indexOf(k)
        if (li === -1 || bi === -1) return [k, v]
        return [k, Math.floor((v * level.shape[li]) / base.shape[bi])]
      }),
    )
  return Object.create(level, {
    getTile: {
      value: (p: any) => level.getTile({ ...p, selection: scale(p.selection) }),
    },
    getRaster: {
      value: (p: any) => level.getRaster({ ...p, selection: scale(p.selection) }),
    },
  })
}
