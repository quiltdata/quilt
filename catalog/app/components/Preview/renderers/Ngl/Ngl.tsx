import * as React from 'react'
import * as M from '@material-ui/core'
import type { Stage } from 'ngl'

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
    height: t.spacing(50),
    overflow: 'auto',
    resize: 'vertical',
    width: '100%',
  },
}))

export interface NglProps extends React.HTMLAttributes<HTMLDivElement> {
  blob: Blob
  ext: string
}

export default function Ngl({ blob, ext, ...props }: NglProps) {
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

  React.useEffect(() => {
    let stage: Stage
    if (viewport.current) {
      renderNgl(blob, ext, viewport.current, t).then((s) => (stage = s))
      window.addEventListener('wheel', handleWheel, { passive: false })
    }
    return () => {
      stage?.dispose()
      window.removeEventListener('wheel', handleWheel)
    }
  }, [blob, ext, handleWheel, t, viewport])

  return <div ref={viewport} className={classes.root} {...props} />
}
