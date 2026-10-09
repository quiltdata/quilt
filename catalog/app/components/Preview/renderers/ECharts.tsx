import * as React from 'react'
import * as M from '@material-ui/core'
import type * as echarts from 'echarts'

const useStyles = M.makeStyles({
  root: {
    height: '400px',
  },
})

interface EChartsEssential {
  option: echarts.EChartsOption
}

interface EChartsProps extends React.HTMLProps<HTMLDivElement> {
  option: echarts.EChartsOption
}

// XXX: consider using components/EChartsChart (may require some adjustments)
function ECharts({ option, ...props }: EChartsProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  const [error, setError] = React.useState<Error | null>(null)
  const classes = useStyles()

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let chart: echarts.ECharts | undefined
    let disposed = false
    // Loaded on first render so echarts stays out of the bucket tabs' bundle.
    import('echarts')
      .then((lib) => {
        if (disposed) return
        chart = lib.init(el)
        chart.setOption(option)
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e)
        if (!disposed && e instanceof Error) setError(e)
      })
    return () => {
      disposed = true
      chart?.dispose()
    }
  }, [containerRef, option])

  if (error)
    return (
      <>
        <M.Typography variant="h6" gutterBottom>
          Unexpected Error
        </M.Typography>
        <M.Typography variant="body1" gutterBottom>
          Something went wrong while loading preview
        </M.Typography>
      </>
    )

  return <div ref={containerRef} className={classes.root} {...props} />
}

export default ({ option }: EChartsEssential, props: React.HTMLProps<HTMLDivElement>) => (
  <ECharts option={option} {...props} />
)
