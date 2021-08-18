import * as React from 'react'
import embed, { VisualizationSpec } from 'vega-embed'

import './vega.css'

const VEGA_OPTIONS = {
  actions: {
    compiled: false,
    editor: false,
    export: true,
    source: false,
  },
}

interface VegaProps extends React.HTMLProps<HTMLDivElement> {
  spec: VisualizationSpec | string
}

function Vega({ spec, ...props }: VegaProps) {
  const [el, setEl] = React.useState<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!el) return
    embed(el, spec, VEGA_OPTIONS)
  }, [el, spec])

  return <div ref={setEl} {...props} />
}

export default (
  { spec }: { spec: VisualizationSpec | string },
  props: React.HTMLProps<HTMLDivElement>,
) => <Vega spec={spec} {...props} />
