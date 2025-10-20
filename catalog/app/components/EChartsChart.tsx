import * as echarts from 'echarts'
import * as React from 'react'
import * as Sentry from '@sentry/react'
import { ErrorBoundary } from 'react-error-boundary'
import * as R from 'ramda'
import useResizeObserver from 'use-resize-observer'
import * as M from '@material-ui/core'

import useMemoEq from 'utils/useMemoEq'

export type DisposeHook = () => void
export type InitHook = (chart: echarts.ECharts) => DisposeHook | void

interface ChartInnerProps {
  option: echarts.EChartsOption
  resize?: boolean
  theme?: Parameters<typeof echarts.init>[1]
  initOptions?: Parameters<typeof echarts.init>[2]
  onInit?: InitHook
}

function ChartInner({
  option,
  resize = true,
  theme = undefined,
  initOptions = undefined,
  onInit = undefined,
  ...props
}: ChartInnerProps & M.BoxProps) {
  const [error, setError] = React.useState<unknown>(null)
  if (error) throw error

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const chartRef = React.useRef<echarts.ECharts | null>(null)
  const initArgs = useMemoEq([theme, initOptions] as const, R.identity)
  const optionMemo = useMemoEq(option, R.identity)
  const onInitRef = React.useRef<InitHook | undefined>()
  onInitRef.current = onInit

  React.useEffect(() => {
    if (!containerRef.current) return
    try {
      const chart = echarts.init(containerRef.current, ...initArgs)
      // XXX: consider accepting setOption opts via props (notMerge, replaceMerge, lazyUpdate)
      chart.setOption(optionMemo)
      const { current: onInitCur } = onInitRef
      let dispose: DisposeHook | void = undefined
      if (onInitCur) dispose = onInitCur(chart)
      chartRef.current = chart
      return () => {
        if (chartRef.current === chart) chartRef.current = null
        if (dispose) dispose()
        chart.dispose()
      }
    } catch (e) {
      setError(e)
    }
  }, [containerRef, initArgs, optionMemo, onInitRef])

  const size = useResizeObserver({ ref: containerRef })
  const sizeStr =
    size.width != null && size.height != null ? `${size.width}x${size.height}` : ''

  React.useEffect(() => {
    if (resize && sizeStr) chartRef.current?.resize()
  }, [resize, sizeStr, chartRef])

  return <M.Box ref={containerRef} {...props} />
}

export type ChartProps = ChartInnerProps & M.BoxProps

const onError = (e: Error) => Sentry.captureException(e)

export function Chart({ option, ...props }: ChartProps) {
  return (
    <ErrorBoundary
      fallback={<M.Typography variant="h6">Unexpected Error</M.Typography>}
      onError={onError}
    >
      <ChartInner option={option} {...props} />
    </ErrorBoundary>
  )
}

export default Chart
