import * as NGL from 'ngl'
import * as React from 'react'
import * as M from '@material-ui/core'

async function renderNgl(blob: Blob, wrapperEl: HTMLDivElement) {
  const stage = new NGL.Stage(wrapperEl)

  const resizeObserver = new window.ResizeObserver(() => stage.handleResize())
  resizeObserver.observe(wrapperEl)

  await stage.loadFile(blob, {
    defaultRepresentation: true,
    ext: 'pdb',
  })
  return stage
}

const useStyles = M.makeStyles((t) => ({
  root: {
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: t.spacing(2),
    paddingBottom: t.spacing(2),
  },
  ngl: {
    height: t.spacing(50),
    overflow: 'auto',
    resize: 'vertical',
    width: '100%',
  },
}))

interface NglProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  blob: Blob
}

function Ngl({ blob, className, ...props }: NglProps) {
  const classes = useStyles()

  const viewport = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (viewport.current) renderNgl(blob, viewport.current)
    return () => {
      // TODO: stage.dispose()
    }
  }, [viewport, blob])
  return (
    <div className={classes.root} {...props}>
      <div ref={viewport} className={classes.ngl} />
    </div>
  )
}

export default (img: NglProps, props: NglProps) => <Ngl {...img} {...props} />
