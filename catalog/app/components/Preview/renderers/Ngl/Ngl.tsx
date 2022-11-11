import * as React from 'react'
import * as M from '@material-ui/core'
import type { Stage } from 'ngl'

import { JsonRecord } from 'utils/types'

import Meta from './Meta'

const NGLLibrary = import('ngl')

async function renderNgl(blob: Blob, ext: string, wrapperEl: HTMLDivElement, t: M.Theme) {
  const NGL = await NGLLibrary
  const stage = new NGL.Stage(wrapperEl, { backgroundColor: t.palette.common.white })

  const resizeObserver = new window.ResizeObserver(() => stage.handleResize())
  resizeObserver.observe(wrapperEl)

  await stage.loadFile(blob, {
    defaultRepresentation: true,
    ext,
  })
  return stage
}

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  meta: {
    left: t.spacing(0),
    opacity: 0.7,
    position: 'absolute',
    top: t.spacing(2),
    '&:hover': {
      opacity: 1,
    },
  },
  wrapper: {
    height: t.spacing(50),
    overflow: 'auto',
    resize: 'vertical',
    width: '100%',
  },
}))

export interface NglFile {
  blob: Blob
  ext: string
  meta?: JsonRecord
}

// type NglProps = NglFile & React.HTMLAttributes<HTMLDivElement>
interface NglProps extends NglFile, React.HTMLAttributes<HTMLDivElement> {}

export default function Ngl({ blob, ext, meta, ...props }: NglProps) {
  console.log('NGL', meta, JSON.stringify(meta))
  const classes = useStyles()

  const t = M.useTheme()
  const viewport = React.useRef<HTMLDivElement | null>(null)

  const handleWheel = React.useCallback(
    (event) => {
      if (viewport.current?.contains(event.target)) {
        event.preventDefault()
      }
    },
    [viewport],
  )
  const [error, setError] = React.useState(null)

  React.useEffect(() => {
    let stage: Stage
    if (viewport.current) {
      renderNgl(blob, ext, viewport.current, t)
        .then((s) => (stage = s))
        .catch((e) => setError(e))
      window.addEventListener('wheel', handleWheel, { passive: false })
    }
    return () => {
      stage?.dispose()
      window.removeEventListener('wheel', handleWheel)
    }
  }, [blob, ext, handleWheel, t, viewport])

  if (error) throw error

  return (
    <div className={classes.root}>
      <div ref={viewport} className={classes.wrapper} {...props} />
      {!!meta && (
        <M.Paper className={classes.meta}>
          <Meta meta={meta} />
        </M.Paper>
      )}
    </div>
  )
}
