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

  const classes = usetyles()

  React.useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current)
    chart.setOption(dataset)
  }, [containerRef, dataset])

  return <div ref={containerRef} className={classes.root} {...props} />
}

export default (
  { dataset }: EChartsEssential,
  props: React.HTMLProps<HTMLDivElement>,
) => <ECharts dataset={dataset} {...props} />
