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

async function deriveContrast(loaded: Loaded, channels: Channel[], plane: Plane) {
  const lowest = loaded.data[loaded.data.length - 1]
  const [y, x] = lowest.shape.slice(-2)
  const fallback: [number, number] = [0, DTYPE_MAX[lowest.dtype] ?? 1]
  return Promise.all(
    channels.map(async (ch) => {
      if (ch.contrastLimits) return ch
      if (y * x > MAX_STATS_PIXELS) return { ...ch, contrastLimits: fallback }
      const { data } = await lowest.getRaster({
        selection: selectionFor(lowest.labels, ch.index, plane),
      })
      const [start, end] = getChannelStats(data as any).contrastLimits
      return { ...ch, contrastLimits: validLimits(start, end) ?? fallback }
    }),
  )
}

export interface ViewerProps {
  handle: LogicalKeyResolver.S3SummarizeHandle
}

export default function Viewer({ handle: { bucket, key, logicalKey } }: ViewerProps) {
  const classes = useStyles()
  const resolveLogicalKey = LogicalKeyResolver.use()
  const sign = AWS.Signer.useS3Signer({ forceProxy: true })
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
      }
  >({ _tag: 'loading' })

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
    // Store keys resolve against the root metadata file's directory: through the package
    // in a package, as plain S3 keys in a bucket.
    const resolvePath =
      resolveLogicalKey && logicalKey
        ? async (path: string) => resolveLogicalKey(s3paths.resolveKey(logicalKey, path))
        : async (path: string): Promise<Model.S3.S3ObjectLocation> => ({
            bucket,
            key: s3paths.resolveKey(key, path),
          })
    const store = createStore(resolvePath, sign)
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
      if (isInterleaved(base.shape)) {
        throw new Error('Interleaved RGB OME-Zarr images are not supported yet.')
      }
      // The tile layer calls this from a promise, so its rethrow of a failed chunk would
      // be an unhandled rejection and a silently blank tile.
      const onTileError = base.onTileError.bind(base)
      base.onTileError = (e: Error) => {
        try {
          onTileError(e)
        } catch (error) {
          if (!cancelled) setState({ _tag: 'error', error: error as Error })
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
      if (!cancelled) setState({ _tag: 'ready', loaded, channels, selections })
    })().catch((error) => {
      if (!cancelled) setState({ _tag: 'error', error })
    })
    return () => {
      cancelled = true
    }
  }, [bucket, key, logicalKey, resolveLogicalKey, sign])

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
        </div>
      )}
    </div>
  )
}
