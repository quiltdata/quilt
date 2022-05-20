import * as NGL from 'ngl'
import * as React from 'react'
import * as M from '@material-ui/core'

async function renderNgl(blob: Blob, ext: string, wrapperEl: HTMLDivElement, t: M.Theme) {
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

interface NglProps extends React.HTMLAttributes<HTMLDivElement> {
  blob: Blob
  ext: string
}

function Ngl({ blob, ext, ...props }: NglProps) {
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
    let stage: NGL.Stage
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

export default (data: NglProps, props: NglProps) => <Ngl {...data} {...props} />
