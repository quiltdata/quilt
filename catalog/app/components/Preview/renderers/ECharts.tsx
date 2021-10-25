import * as React from 'react'
import * as M from '@material-ui/core'
import * as echarts from 'echarts'

const usetyles = M.makeStyles({
  root: {
    height: '400px',
  },
})

interface EChartsEssential {
  dataset: echarts.EChartsOption
}

interface EChartsProps extends React.HTMLProps<HTMLDivElement> {
  dataset: echarts.EChartsOption
}

function ECharts({ dataset, ...props }: EChartsProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  const [error, setError] = React.useState<Error | null>(null)
  const classes = usetyles()

  React.useEffect(() => {
    if (!containerRef.current) return
    try {
      const chart = echarts.init(containerRef.current)
      chart.setOption(dataset)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
      if (e instanceof Error) setError(e)
    }
  }, [containerRef, dataset])

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

export default (
  { dataset }: EChartsEssential,
  props: React.HTMLProps<HTMLDivElement>,
) => <ECharts dataset={dataset} {...props} />
