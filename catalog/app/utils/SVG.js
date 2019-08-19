import * as React from 'react'
import uuid from 'uuid/v1'

import tagged from 'utils/tagged'

export const Paint = tagged(['Color', 'Server', 'None'])

export const pointsToSVG = (points) => points.map(({ x, y }) => `${x} ${y}`).join(' ')

export const usePaint = (paint) => {
  const id = React.useMemo(uuid, [])
  return React.useMemo(
    () =>
      Paint.case(
        {
          Color: (value) => ({ ref: value, def: null }),
          Server: (el) => ({ ref: `url(#${id})`, def: React.cloneElement(el, { id }) }),
          None: () => ({ ref: 'none', def: null }),
        },
        paint,
      ),
    [paint, id],
  )
}
