import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as SVG from 'utils/SVG'

// TODO: stagger?
export default function MultiSparkline({
  data, // PT.arrayOf(PT.arrayOf(PT.number)).isRequired,
  cursor,
  onCursor,
  width = 200,
  height = 20,
  lineThickness = 1,
  lineStroke = SVG.Paint.Color('currentColor'),
  lineStrokes = [],
  extendL = false,
  extendR = false,
  cursorLineThickness = lineThickness,
  cursorCircleR = cursorLineThickness,
  cursorCircleFill = SVG.Paint.None(),
  fade = 0.5,
  padding = 3,
  px = padding,
  py = padding,
  pt = py,
  pb = py,
  pl = px,
  pr = px,
  boxProps,
  ...props
}) {
  const max = React.useMemo(
    () => Math.max(...data.map((r) => (r ? Math.max(...r) : 0))),
    [data],
  )
  const len = React.useMemo(() => Math.max(...data.map((r) => (r ? r.length : 0))), [
    data,
  ])
  const vfactor = (height - pt - pb) / max
  const hfactor = (width - pl - pr) / (len - 1)

  const handleMove = React.useCallback(
    (e) => {
      if (!onCursor) return
      const rect = e.currentTarget.getBoundingClientRect()
      const posX = (e.clientX - rect.x - pl) / (rect.width - pl - pr)
      const posY = (rect.y + rect.height - pb - e.clientY) / (rect.height - pt - pb)
      const value = max * posY
      const j = R.clamp(0, len - 1, Math.round(posX * (len - 1)))
      // choose the row with the closest value at index j
      const i = data.reduce((prev, r, ii) => {
        if (!r) return prev
        const v = r[j]
        if (v == null) return prev
        if (prev == null) return ii
        const prevV = data[prev][j]
        if (Math.abs(v - value) < Math.abs(prevV - value)) return ii
        return prev
      }, null)
      onCursor({ i, j })
    },
    [onCursor, data, pl, pr, pt, pb],
  )

  const handleLeave = React.useCallback(() => {
    if (onCursor) onCursor(null)
  }, [onCursor])

  const lines = React.useMemo(
    () =>
      data.map((r) => {
        if (!r || !r.length) return null
        const dataPoints = r.map((d, i) => ({
          x: pl + i * hfactor,
          y: pt + (max - d) * vfactor,
        }))
        return [
          ...(extendL ? [{ ...dataPoints[0], x: 0 }] : []),
          ...dataPoints,
          ...(extendR ? [{ ...dataPoints[r.length - 1], x: width }] : []),
        ]
      }),
    [data, hfactor, vfactor, max, width, pt, pl, extendR, extendL],
  )

  const cursorCircleFillPaint = SVG.usePaint(cursorCircleFill)

  const linePaints = SVG.usePaint(lineStrokes)
  const linePaint = SVG.usePaint(lineStroke)

  const cursorPos = cursor && lines[cursor.i][cursor.j + (extendL ? 1 : 0)]

  return (
    <M.Box
      component="svg"
      viewBox={`0 0 ${width} ${height}`}
      onMouseLeave={handleLeave}
      onMouseMove={handleMove}
      {...props}
      {...boxProps}
    >
      <defs>
        {cursorCircleFillPaint.def}
        {linePaints.map((p) => p.def)}
        {linePaint.def}
      </defs>
      <g>
        {lines.map(
          (points, i) =>
            points && (
              <polyline
                // eslint-disable-next-line react/no-array-index-key
                key={`line:${i}`}
                points={SVG.pointsToSVG(points)}
                stroke={(linePaints[i] || linePaint).ref}
                strokeWidth={
                  cursor && cursor.i === i ? cursorLineThickness : lineThickness
                }
                strokeOpacity={cursor && cursor.i !== i ? fade : 1}
                strokeLinecap="round"
                strokeLinejoin="miter"
                fill="none"
              />
            ),
        )}
        {!!cursorPos && (
          <g>
            <circle
              cx={cursorPos.x}
              cy={cursorPos.y}
              r={cursorCircleR}
              stroke={(linePaints[cursor.i] || linePaint).ref}
              strokeWidth={cursorLineThickness}
              fill={cursorCircleFillPaint.ref}
            />
          </g>
        )}
      </g>
    </M.Box>
  )
}
