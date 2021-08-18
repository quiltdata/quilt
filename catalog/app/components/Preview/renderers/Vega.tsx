import * as React from 'react'
import embed, { VisualizationSpec } from 'vega-embed'
import * as M from '@material-ui/core'

const VEGA_OPTIONS = {
  actions: {
    compiled: false,
    editor: false,
    export: true,
    source: false,
  },
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

interface VegaProps extends React.HTMLProps<HTMLDivElement> {
  spec: VisualizationSpec | string
}

function Vega({ spec, ...props }: VegaProps) {
  const classes = useStyles()

  const [el, setEl] = React.useState<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!el) return
    embed(el, spec, VEGA_OPTIONS)
  }, [el, spec])

  return <div className={classes.root} ref={setEl} {...props} />
}

export default (
  { spec }: { spec: VisualizationSpec | string },
  props: React.HTMLProps<HTMLDivElement>,
) => <Vega spec={spec} {...props} />
