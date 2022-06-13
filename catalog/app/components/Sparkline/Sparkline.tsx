import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as SVG from 'utils/SVG'

interface SparklineProps extends M.BoxProps {
  data: number[]
  onCursor?: (idx: number | null) => void
  width?: number
  height?: number
  stroke?: $TSFixMe // SVG.Paint
  fill?: $TSFixMe // SVG.Paint
  contourThickness?: number
  contourStroke?: $TSFixMe // SVG.Paint
  extendL?: boolean
  extendR?: boolean
  cursorLineThickness?: number
  cursorLineExtendUp?: boolean
  cursorLineExtendDown?: boolean
  cursorLineStroke?: $TSFixMe // SVG.Paint
  cursorCircleThickness?: number
  cursorCircleR?: number
  cursorCircleFill?: $TSFixMe // SVG.Paint
  cursorCircleStroke?: $TSFixMe // SVG.Paint
  padding?: number
  px?: number
  py?: number
  pt?: number
  pb?: number
  pl?: number
  pr?: number
  boxProps?: M.BoxProps
}

export default function Sparkline({
  data, // PT.arrayOf(PT.number).isRequired,
  onCursor,
  width = 200,
  height = 20,
  stroke = SVG.Paint.Color('currentColor'),
  fill = SVG.Paint.None(),
  contourThickness = 1,
  contourStroke = stroke,
  extendL = false,
  extendR = false,
  cursorLineThickness = contourThickness,
  cursorLineExtendUp = true,
  cursorLineExtendDown = true,
  cursorLineStroke = stroke,
  cursorCircleThickness = cursorLineThickness,
  cursorCircleR = cursorCircleThickness,
  cursorCircleFill = SVG.Paint.None(),
  cursorCircleStroke = stroke,
  padding = 3,
  px = padding,
  py = padding,
  pt = py,
  pb = py,
  pl = px,
  pr = px,
  boxProps,
  ...props
}: SparklineProps) {
  const [cursor, showCursor] = React.useState<number | null>(null)
  const hideCursor = React.useCallback(() => showCursor(null), [showCursor])

  const handleMove = React.useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const pos = (e.clientX - rect.x - pl) / (rect.width - pl - pr)
      const step = 1 / (data.length - 1)
      const idx = R.clamp(0, data.length - 1, Math.round(pos / step))
      showCursor(idx)
      if (onCursor) onCursor(idx)
    },
    [showCursor, onCursor, data, pl, pr],
  )

  const handleLeave = React.useCallback(() => {
    hideCursor()
    if (onCursor) onCursor(null)
  }, [hideCursor, onCursor])

  const contourShape = React.useMemo(() => {
    const max = Math.max(...data) || 1

    const vfactor = (height - pt - pb) / max
    const hfactor = (width - pl - pr) / (data.length - 1)

    const dataPoints = data.map((d, i) => ({
      x: pl + i * hfactor,
      y: pt + (max - d) * vfactor,
    }))
    return [
      ...(extendL ? [{ ...dataPoints[0], x: 0 }] : []),
      ...dataPoints,
      ...(extendR ? [{ ...dataPoints[data.length - 1], x: width }] : []),
    ]
  }, [data, width, height, pt, pb, pl, pr, extendR, extendL])

  const contourStrokePaint = SVG.usePaint(contourStroke)
  const cursorLineStrokePaint = SVG.usePaint(cursorLineStroke)
  const cursorCircleFillPaint = SVG.usePaint(cursorCircleFill)
  const cursorCircleStrokePaint = SVG.usePaint(cursorCircleStroke)
  const fillPaint = SVG.usePaint(fill)

  const fillShape: null | typeof contourShape = React.useMemo(
    () =>
      SVG.Paint.case(
        {
          None: () => null,
          _: () => [
            ...contourShape,
            { ...contourShape[contourShape.length - 1], y: height },
            { ...contourShape[0], y: height },
            contourShape[0],
          ],
        },
        fill,
      ),
    [fill, contourShape, height],
  )

  const cursorPos = cursor === null ? null : contourShape[cursor + (extendL ? 1 : 0)]

  return (
    <M.Box
      component="svg"
      // @ts-expect-error
      viewBox={`0 0 ${width} ${height}`}
      onMouseLeave={handleLeave}
      onMouseMove={handleMove}
      {...props}
      {...boxProps}
    >
      <defs>
        {contourStrokePaint.def}
        {cursorLineStrokePaint.def}
        {cursorCircleFillPaint.def}
        {cursorCircleStrokePaint.def}
        {fillPaint.def}
      </defs>
      <g>
        {fillShape && (
          <polyline
            points={SVG.pointsToSVG(fillShape)}
            fill={fillPaint.ref}
            pointerEvents="auto"
            stroke="none"
            strokeWidth="0"
          />
        )}
        <polyline
          points={SVG.pointsToSVG(contourShape)}
          stroke={contourStrokePaint.ref}
          strokeWidth={contourThickness}
          strokeLinecap="round"
          strokeLinejoin="miter"
          fill="none"
        />
        {!!cursorPos && !!onCursor && (
          <g>
            {(cursorLineExtendUp || cursorLineExtendDown) && (
              <line
                x1={cursorPos.x}
                y1={cursorLineExtendUp ? 0 : cursorPos.y}
                x2={cursorPos.x}
                y2={cursorLineExtendDown ? height : cursorPos.y}
                stroke={cursorLineStrokePaint.ref}
                strokeWidth={cursorLineThickness}
              />
            )}
            <circle
              cx={cursorPos.x}
              cy={cursorPos.y}
              r={cursorCircleR}
              stroke={cursorCircleStrokePaint.ref}
              strokeWidth={cursorCircleThickness}
              fill={cursorCircleFillPaint.ref}
            />
          </g>
        )}
      </g>
    </M.Box>
  )
}
