import * as React from 'react'
import type { VisualizationSpec } from 'vega-embed'
import * as M from '@material-ui/core'

const VEGA_OPTIONS = {
  actions: {
    compiled: false,
    editor: false,
    export: true,
    source: false,
  },
  scaleFactor: 2,
}

const useStyles = M.makeStyles({
  root: {
    maxWidth: '100%',
    '&.vega-embed .vega-actions': {
      right: '38px',
      top: 0,
    },
    '&.vega-embed .vega-actions::after': {
      display: 'none',
    },
    '&.vega-embed .vega-actions::before': {
      display: 'none',
    },
    '&.vega-embed .chart-wrapper': {
      maxWidth: '100%',
      overflow: 'auto',
    },
  },
})

interface VegaEssential {
  spec: VisualizationSpec | string
}

interface VegaProps extends React.HTMLProps<HTMLDivElement>, VegaEssential {}

function Vega({ spec, ...props }: VegaProps) {
  const classes = useStyles()

  const [el, setEl] = React.useState<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!el) return
    let cancelled = false
    // Loaded on first render so vega/vega-lite stay out of the bucket tabs' bundle.
    import('vega-embed')
      .then(({ default: embed }) =>
        cancelled ? undefined : embed(el, spec, VEGA_OPTIONS),
      )
      // eslint-disable-next-line no-console
      .catch((e) => console.error(e))
    return () => {
      cancelled = true
    }
  }, [el, spec])

  return <div className={classes.root} ref={setEl} {...props} />
}

export default ({ spec }: VegaEssential, props: React.HTMLProps<HTMLDivElement>) => (
  <Vega spec={spec} {...props} />
)
