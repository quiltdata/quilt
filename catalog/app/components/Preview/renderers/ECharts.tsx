import * as React from 'react'
import * as M from '@material-ui/core'
import * as echarts from 'echarts'

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

function ECharts({ option, ...props }: EChartsProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  const [error, setError] = React.useState<Error | null>(null)
  const classes = useStyles()

  React.useEffect(() => {
    if (!containerRef.current) return
    try {
      const chart = echarts.init(containerRef.current)
      chart.setOption(option)
      return () => chart.dispose()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
      if (e instanceof Error) setError(e)
      return () => setError(null)
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
