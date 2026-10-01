import * as React from 'react'
import * as M from '@material-ui/core'
import {
  getChannelStats,
  loadOmeZarrFromStore,
  PictureInPictureViewer,
} from '@hms-dbmi/viv'

import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'

import { createPathResolver } from '../../loaders/useSignObjectUrls'

import { type Channel, channelsFromMetadata, defaultPlane } from './channels'
import { createStore } from './store'

const HEIGHT = 600

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

// One plane of every non-spatial axis for a given channel.
const selectionFor = (labels: string[], c: number, plane: Plane) =>
  Object.fromEntries(
    labels
      .filter((l) => l !== 'x' && l !== 'y')
      .map((l) => [l, l === 'c' ? c : (plane[l as keyof Plane] ?? 0)]),
  )

async function deriveContrast(loaded: Loaded, channels: Channel[], plane: Plane) {
  const lowest = loaded.data[loaded.data.length - 1]
  return Promise.all(
    channels.map(async (ch) => {
      if (ch.contrastLimits) return ch
      const { data } = await lowest.getRaster({
        selection: selectionFor(lowest.labels, ch.index, plane),
      })
      const { contrastLimits } = getChannelStats(data as any)
      return { ...ch, contrastLimits: contrastLimits as [number, number] }
    }),
  )
}

export interface ViewerProps {
  handle: Model.S3.S3ObjectLocation
}

export default function Viewer({ handle }: ViewerProps) {
  const classes = useStyles()
  const resolveLogicalKey = LogicalKeyResolver.use()
  const sign = AWS.Signer.useS3Signer({ forceProxy: true })
  const ref = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(0)
  const [state, setState] = React.useState<
    | { _tag: 'loading' }
    | { _tag: 'error'; error: Error }
    | { _tag: 'ready'; loaded: Loaded; channels: Channel[]; plane: Plane }
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
    const store = createStore(createPathResolver(resolveLogicalKey, handle), sign)
    ;(async () => {
      const loaded = await loadOmeZarrFromStore(store as any)
      const base = loaded.data[0]
      const cIndex = base.labels.indexOf('c')
      const channelCount = cIndex === -1 ? 1 : base.shape[cIndex]
      const omero = (loaded.metadata as any).omero
      const plane = defaultPlane(omero, base.shape, base.labels)
      const channels = await deriveContrast(
        loaded,
        channelsFromMetadata(omero, channelCount),
        plane,
      )
      if (!cancelled) setState({ _tag: 'ready', loaded, channels, plane })
    })().catch((error) => {
      if (!cancelled) setState({ _tag: 'error', error })
    })
    return () => {
      cancelled = true
    }
  }, [handle, resolveLogicalKey, sign])

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
            selections={state.channels.map((c) =>
              selectionFor(state.loaded.data[0].labels, c.index, state.plane),
            )}
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
