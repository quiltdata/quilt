import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as SVG from 'utils/SVG'
import { TaggedInstance } from 'utils/tagged'
import usePrevious from 'utils/usePrevious'

interface Cursor {
  i: number | null
  j: number
}

// A single SVG paint (as produced by SVG.Paint) or a list of them.
type Paint = TaggedInstance
type Paints = Paint | Paint[]

interface Point {
  x: number
  y: number
}

interface MultiSparklineProps extends Omit<M.BoxProps, 'width' | 'height' | 'ref'> {
  data: number[][]
  onCursor?: (cursor: Cursor | null) => void
  width?: number
  height?: number
  areaFills?: Paints
  lineStroke?: Paint
  lineThickness?: number
  axisStroke?: Paint
  axisThickness?: number
  cursorStroke?: Paint
  cursorThickness?: number
  axis?: boolean
  extendL?: boolean
  extendR?: boolean
  padding?: number
  px?: number
  py?: number
  pt?: number
  pb?: number
  pl?: number
  pr?: number
  boxProps?: M.BoxProps
}

export default function MultiSparkline({
  data,
  onCursor,
  width = 200,
  height = 20,
  areaFills,
  lineStroke = SVG.Paint.Color('currentColor'),
  lineThickness = 1,
  axisStroke = lineStroke,
  axisThickness = lineThickness,
  cursorStroke = lineStroke,
  cursorThickness = lineThickness,
  axis = true,
  extendL = false,
  extendR = false,
  padding = 1,
  px = padding,
  py = padding,
  pt = py,
  pb = py,
  pl = px,
  pr = px,
  boxProps,
  ...props
}: MultiSparklineProps) {
  const stacked: number[][] = React.useMemo(
    () =>
      (
        R.pipe(
          R.transpose,
          R.map(
            R.reduce((col: number[], i: number) => col.concat(R.last(col)! + i), [
              0,
            ] as number[]),
          ),
          R.transpose,
        ) as (d: number[][]) => number[][]
      )(data),
    [data],
  )
  const max = React.useMemo(() => Math.max(...R.last(stacked)!), [stacked])
  const len = React.useMemo(
    () => Math.max(...data.map((r) => (r ? r.length : 0))),
    [data],
  )
  const vfactor = (height - pt - pb) / max
  const hfactor = (width - pl - pr) / (len - 1)
  const xScale = React.useMemo(() => (i: number) => pl + i * hfactor, [pl, hfactor])
  const yScale = React.useMemo(
    () => (v: number) => pt + (max - v) * vfactor,
    [pt, max, vfactor],
  )

  const mkPoints = React.useMemo(
    () =>
      (vs: number[]): Point[] => {
        let points: Point[] = vs.map((v, i) => ({ x: xScale(i), y: yScale(v) }))
        if (extendR) points = points.concat({ x: width, y: R.last(points)!.y })
        if (extendL) points = [{ x: 0, y: yScale(0) }].concat(points)
        return points
      },
    [xScale, yScale, extendL, extendR, width],
  )

  interface Figure {
    area: Point[]
    stroke: Point[]
  }
  const figures: Figure[] = React.useMemo(() => {
    const pairs = R.aperture(2, stacked) as [number[], number[]][]
    const figs = pairs.map(([bottom, top]) => ({
      area: [...mkPoints(top), ...R.reverse(mkPoints(bottom))],
      stroke: [...mkPoints(top), ...R.reverse(mkPoints(top))],
    }))
    return R.reverse(figs)
  }, [stacked, mkPoints])

  const [cursorI, setCursorI] = React.useState<number | null>(null)
  const [cursorJ, setCursorJ] = React.useState<number | null>(null)
  const cursor: Cursor | null = cursorJ == null ? null : { i: cursorI, j: cursorJ }

  usePrevious(cursor, (prev) => {
    if (onCursor && !R.equals(cursor, prev)) {
      onCursor(cursor)
    }
  })

  const handleMove = React.useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const posX = (e.clientX - rect.x - pl) / (rect.width - pl - pr)
      const j = R.clamp(0, len - 1, Math.round(posX * (len - 1)))
      setCursorJ(j)
    },
    [setCursorJ, pl, pr, len],
  )

  const handleLeave = React.useCallback(() => {
    setCursorJ(null)
  }, [setCursorJ])

  const handleAreaEnter = (i: number) => () => {
    setCursorI(i)
  }

  const handleAreaLeave = React.useCallback(() => {
    setCursorI(null)
  }, [setCursorI])

  const areaPaints = SVG.usePaint(areaFills)
  const axisPaint = SVG.usePaint(axisStroke)
  const cursorPaint = SVG.usePaint(cursorStroke)

  // MUI v4's BoxProps does not pick up the rendered element's attributes when
  // `component="svg"`, so render through a permissive cast to allow `viewBox`.
  const Svg = M.Box as React.ComponentType<any>
  return (
    <Svg
      component="svg"
      viewBox={`0 0 ${width} ${height}`}
      onMouseLeave={handleLeave}
      onMouseMove={handleMove}
      {...props}
      {...boxProps}
    >
      <defs>
        {areaPaints.map((p: { def: React.ReactElement | null }) => p.def)}
        {!!axis && axisPaint.def}
        {!!onCursor && cursorPaint.def}
      </defs>
      <g>
        {figures.map(({ area, stroke }, i) => (
          <g
            // eslint-disable-next-line react/no-array-index-key
            key={`area:${i}`}
            onMouseEnter={handleAreaEnter(i)}
            onMouseLeave={handleAreaLeave}
            opacity={onCursor && cursor?.i != null && cursor.i !== i ? 0.4 : 1}
          >
            <polygon
              points={SVG.pointsToSVG(area)}
              fill={areaPaints[i].ref}
              fillOpacity={onCursor && cursor?.i === i ? 0.6 : 0.5}
            />
            <polyline
              points={SVG.pointsToSVG(stroke)}
              stroke={areaPaints[i].ref}
              strokeWidth={2}
            />
          </g>
        ))}
        {!!cursor && !!onCursor && (
          <line
            x1={xScale(cursor.j)}
            x2={xScale(cursor.j)}
            y1={0}
            y2={yScale(0)}
            stroke={cursorPaint.ref}
            strokeWidth={cursorThickness}
            pointerEvents="none"
          />
        )}
        {!!axis && (
          <line
            x1={0}
            x2={width}
            y1={yScale(0)}
            y2={yScale(0)}
            stroke={axisPaint.ref}
            strokeWidth={axisThickness}
            pointerEvents="none"
          />
        )}
      </g>
    </Svg>
  )
}
