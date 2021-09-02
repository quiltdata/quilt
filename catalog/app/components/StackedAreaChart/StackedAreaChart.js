import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as SVG from 'utils/SVG'
import usePrevious from 'utils/usePrevious'

const useStyles = M.makeStyles({
  root: {
    opacity: 0.8,
    '&:hover': {
      opacity: 1,
    },
  },
})

export default function MultiSparkline({
  data, // PT.arrayOf(PT.arrayOf(PT.number)).isRequired,
  onCursor,
  width = 200,
  height = 20,
  areaFills, // array of SVG.Paint
  lineStroke = SVG.Paint.Color('currentColor'),
  lineThickness = 1,
  axisStroke = lineStroke,
  axisThickness = lineThickness,
  cursorStroke = lineStroke,
  cursorThickness = lineThickness,
  axis = true,
  extendL = false,
  extendR = false,
  fade = 0.5,
  padding = 1,
  px = padding,
  py = padding,
  pt = py,
  pb = py,
  pl = px,
  pr = px,
  boxProps,
  ...props
}) {
  const classes = useStyles()
  const stacked = React.useMemo(
    () =>
      R.pipe(
        R.transpose,
        R.map(R.reduce((col, i) => col.concat(R.last(col) + i), [0])),
        R.transpose,
      )(data),
    [data],
  )
  const max = React.useMemo(() => Math.max(...R.last(stacked)), [stacked])
  const len = React.useMemo(
    () => Math.max(...data.map((r) => (r ? r.length : 0))),
    [data],
  )
  const vfactor = (height - pt - pb) / max
  const hfactor = (width - pl - pr) / (len - 1)
  const xScale = React.useMemo(() => (i) => pl + i * hfactor, [pl, hfactor])
  const yScale = React.useMemo(() => (v) => pt + (max - v) * vfactor, [pt, max, vfactor])

  const mkPoints = React.useMemo(
    () =>
      R.pipe(
        R.addIndex(R.map)((v, i) => ({ x: xScale(i), y: yScale(v) })),
        extendR
          ? (points) => points.concat({ x: width, y: R.last(points).y })
          : R.identity,
        extendL ? (points) => [{ x: 0, y: yScale(0) }].concat(points) : R.identity,
      ),
    [xScale, yScale, extendL, extendR, width],
  )

  const areas = React.useMemo(
    () =>
      R.pipe(
        R.aperture(2),
        R.map(([bottom, top]) => R.concat(mkPoints(top), R.reverse(mkPoints(bottom)))),
      )(stacked),
    [stacked, mkPoints],
  )

  const [cursorI, setCursorI] = React.useState(null)
  const [cursorJ, setCursorJ] = React.useState(null)
  const cursor = cursorJ == null ? null : { i: cursorI, j: cursorJ }

  usePrevious(cursor, (prev) => {
    if (onCursor && !R.equals(cursor, prev)) {
      onCursor(cursor)
    }
  })

  const handleMove = React.useCallback(
    (e) => {
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

  const handleAreaEnter = (i) => () => {
    setCursorI(i)
  }

  const handleAreaLeave = React.useCallback(() => {
    setCursorI(null)
  }, [setCursorI])

  const areaPaints = SVG.usePaint(areaFills)
  const axisPaint = SVG.usePaint(axisStroke)
  const cursorPaint = SVG.usePaint(cursorStroke)

  return (
    <M.Box
      className={classes.root}
      component="svg"
      viewBox={`0 0 ${width} ${height}`}
      onMouseLeave={handleLeave}
      onMouseMove={handleMove}
      {...props}
      {...boxProps}
    >
      <defs>
        {areaPaints.map((p) => p.def)}
        {!!axis && axisPaint.def}
        {!!onCursor && cursorPaint.def}
      </defs>
      <g>
        {areas.map(
          (points, i) =>
            points && (
              <polygon
                // eslint-disable-next-line react/no-array-index-key
                key={`area:${i}`}
                onMouseEnter={handleAreaEnter(i)}
                onMouseLeave={handleAreaLeave}
                points={SVG.pointsToSVG(points)}
                fill={areaPaints[i].ref}
                fillOpacity={
                  onCursor && cursor && cursor.i != null && cursor.i !== i ? fade : 1
                }
              />
            ),
        )}
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
    </M.Box>
  )
}
