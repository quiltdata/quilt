import * as React from 'react'
import * as M from '@material-ui/core'
import {
  getChannelStats,
  isInterleaved,
  loadOmeZarrFromStore,
  PictureInPictureViewer,
} from '@hms-dbmi/viv'

import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'

import * as s3paths from 'utils/s3paths'

import {
  type Channel,
  channelsFromMetadata,
  defaultPlane,
  onBaseGrid,
  validLimits,
} from './channels'
import { createStore } from './store'

const HEIGHT = 600

// Contrast is estimated from the lowest resolution level. A single-resolution store makes
// that the full image, so above this many pixels fall back to the dtype's range.
const MAX_STATS_PIXELS = 2048 * 2048

type Loaded = Awaited<ReturnType<typeof loadOmeZarrFromStore>>

const useStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  canvas: {
    background: '#000',
    height: HEIGHT,
    position: 'relative',
    width: '100%',
  },
  channels: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
    marginTop: t.spacing(1),
  },
  swatch: {
    borderRadius: '50%',
    display: 'inline-block',
    height: 10,
    width: 10,
  },
}))

type Plane = { z: number; t: number }

const selectionFor = (labels: string[], c: number, plane: Plane) =>
  Object.fromEntries(
    labels
      .filter((l) => l !== 'x' && l !== 'y')
      .map((l) => [l, l === 'c' ? c : (plane[l as keyof Plane] ?? 0)]),
  )

const DTYPE_MAX: Record<string, number> = {
  Uint8: 255,
  Int8: 127,
  Uint16: 65535,
  Int16: 32767,
  Uint32: 4294967295,
  Int32: 2147483647,
}

// Floats have no natural range; [0, 1] fits normalized data and stats cover the rest.
const FLOAT_FALLBACK = 1

async function deriveContrast(loaded: Loaded, channels: Channel[], plane: Plane) {
  const lowest = loaded.data[loaded.data.length - 1]
  const [y, x] = lowest.shape.slice(-2)
  const fallback: [number, number] = [0, DTYPE_MAX[lowest.dtype] ?? FLOAT_FALLBACK]
  return Promise.all(
    channels.map(async (ch) => {
      if (ch.contrastLimits) return ch
      const selection = selectionFor(lowest.labels, ch.index, plane)
      // A single-resolution store makes the lowest level the full image; sample one tile.
      const { data } =
        y * x > MAX_STATS_PIXELS
          ? await lowest.getTile({
              x: Math.floor(x / lowest.tileSize / 2),
              y: Math.floor(y / lowest.tileSize / 2),
              selection,
            })
          : await lowest.getRaster({ selection })
      const [start, end] = getChannelStats(data as any).contrastLimits
      return { ...ch, contrastLimits: validLimits(start, end) ?? fallback }
    }),
  )
}

export interface ViewerProps {
  handle: LogicalKeyResolver.S3SummarizeHandle
}

export default function Viewer({
  handle: { bucket, key, version, logicalKey },
}: ViewerProps) {
  const classes = useStyles()
  const resolveLogicalKey = LogicalKeyResolver.use()
  const sign = AWS.Signer.useS3Signer({ forceProxy: true })
  // The signer's identity follows the bucket-region cache; reloading on every change
  // would reset the view, so the store reads it through a ref.
  const signRef = React.useRef(sign)
  signRef.current = sign
  const ref = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(0)
  const [state, setState] = React.useState<
    | { _tag: 'loading' }
    | { _tag: 'error'; error: Error }
    | {
        _tag: 'ready'
        loaded: Loaded
        channels: Channel[]
        // Built once: Viv refetches every tile when this array's identity changes.
        selections: Record<string, number>[]
        plane: { z: number; t: number }
        depth: { z: number; t: number }
        channelCount: number
      }
  >({ _tag: 'loading' })
  const [tileError, setTileError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  React.useEffect(() => {
    let cancelled = false
    setState({ _tag: 'loading' })
    setTileError(null)
    if (resolveLogicalKey && !logicalKey) {
      // Inside a package the store's siblings must come from the same revision; reading
      // them as plain S3 keys would mix revisions silently.
      setState({
        _tag: 'error',
        error: new Error('Missing logical key for package entry'),
      })
      return
    }
    // Store keys resolve against the root metadata file's directory: through the package
    // in a package, as plain S3 keys in a bucket. A bucket store is not versioned as a
    // unit, so every key reads at latest rather than mixing the root's old version in.
    const inPackage = !!(resolveLogicalKey && logicalKey)
    const resolvePath = inPackage
      ? async (path: string) => resolveLogicalKey!(s3paths.resolveKey(logicalKey!, path))
      : async (path: string): Promise<Model.S3.S3ObjectLocation> => ({
          bucket,
          key: s3paths.resolveKey(key, path),
        })
    const store = createStore(resolvePath, (h) => signRef.current(h), {
      forbiddenIsMissing: !inPackage,
      rootPath: (logicalKey || key).split('/').pop()!,
    })
    ;(async () => {
      const all = await loadOmeZarrFromStore(store as any)
      const base = all.data[0]
      const loaded = {
        ...all,
        data: all.data.map((l) => (l === base ? l : onBaseGrid(l, base))),
      }
      const cIndex = base.labels.indexOf('c')
      // ponytail: interleaved RGB(A) (`yxc`) is not composited yet; NGFF puts `c` first,
      // so this is rare. Viv's ZarrPixelSource cannot select all bands of one pixel.
      if (base.labels[base.labels.length - 1] === 'c' && isInterleaved(base.shape)) {
        throw new Error('Interleaved RGB OME-Zarr images are not supported yet.')
      }
      // The tile layer calls this from a promise, so its rethrow of a failed chunk would
      // be an unhandled rejection and a silently blank tile. One failed tile is reported
      // without discarding the rest; deck.gl requests it again on the next pan or zoom.
      const onTileError = base.onTileError.bind(base)
      base.onTileError = (e: Error) => {
        try {
          onTileError(e)
        } catch (error) {
          if (!cancelled) setTileError((error as Error).message)
        }
      }
      const channelCount = cIndex === -1 ? 1 : base.shape[cIndex]
      const omero = (loaded.metadata as any).omero
      const plane = defaultPlane(omero, base.shape, base.labels)
      const channels = await deriveContrast(
        loaded,
        channelsFromMetadata(omero, channelCount),
        plane,
      )
      const selections = channels.map((c) => selectionFor(base.labels, c.index, plane))
      const extent = (axis: string) => {
        const i = base.labels.indexOf(axis)
        return i === -1 ? 1 : base.shape[i]
      }
      const depth = { z: extent('z'), t: extent('t') }
      if (!cancelled) {
        setState({
          _tag: 'ready',
          loaded,
          channels,
          selections,
          plane,
          depth,
          channelCount,
        })
      }
    })().catch((error) => {
      if (!cancelled) setState({ _tag: 'error', error })
    })
    return () => {
      cancelled = true
    }
  }, [bucket, key, version, logicalKey, resolveLogicalKey])

  const toggle = (index: number) =>
    setState((s) =>
      s._tag === 'ready'
        ? {
            ...s,
            channels: s.channels.map((c) =>
              c.index === index ? { ...c, visible: !c.visible } : c,
            ),
          }
        : s,
    )

  return (
    <div className={classes.root}>
      <div className={classes.canvas} ref={ref}>
        {state._tag === 'loading' && (
          <M.Box display="flex" alignItems="center" justifyContent="center" height="100%">
            <M.CircularProgress />
          </M.Box>
        )}
        {state._tag === 'error' && (
          <M.Box p={2} color="common.white">
            <M.Typography>Unable to load OME-Zarr image.</M.Typography>
            <M.Typography variant="caption">{state.error.message}</M.Typography>
          </M.Box>
        )}
        {state._tag === 'ready' && width > 0 && (
          <PictureInPictureViewer
            loader={state.loaded.data}
            selections={state.selections}
            colors={state.channels.map((c) => c.color)}
            contrastLimits={state.channels.map((c) => c.contrastLimits)}
            channelsVisible={state.channels.map((c) => c.visible)}
            overview={{ boundingBoxColor: [255, 255, 255] }}
            overviewOn={state.loaded.data.length > 1}
            height={HEIGHT}
            width={width}
            snapScaleBar
          />
        )}
      </div>
      {state._tag === 'ready' && (
        <div className={classes.channels}>
          {version && !logicalKey && (
            <M.Typography variant="caption" color="textSecondary">
              Showing the latest version of this store
            </M.Typography>
          )}
          {(state.depth.z > 1 || state.depth.t > 1) && (
            <M.Typography variant="caption" color="textSecondary">
              {[
                state.depth.z > 1 && `z ${state.plane.z + 1} of ${state.depth.z}`,
                state.depth.t > 1 && `t ${state.plane.t + 1} of ${state.depth.t}`,
              ]
                .filter(Boolean)
                .join(', ')}
            </M.Typography>
          )}
          {state.channels.map((c) => (
            <M.Chip
              key={c.index}
              size="small"
              variant={c.visible ? 'default' : 'outlined'}
              onClick={() => toggle(c.index)}
              label={c.label}
              icon={
                <span
                  className={classes.swatch}
                  style={{ background: `rgb(${c.color.join(',')})` }}
                />
              }
            />
          ))}
          {state.channelCount > state.channels.length && (
            <M.Typography variant="caption" color="textSecondary">
              Showing {state.channels.length} of {state.channelCount} channels
            </M.Typography>
          )}
          {tileError && (
            <M.Typography variant="caption" color="error">
              Some tiles failed to load and are left blank: {tileError}
            </M.Typography>
          )}
        </div>
      )}
    </div>
  )
}
