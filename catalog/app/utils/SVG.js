import * as R from 'ramda'
import * as React from 'react'
import * as uuid from 'uuid'

import tagged from 'utils/tagged'
import useMemoEq from 'utils/useMemoEq'

export const Paint = tagged(['Color', 'Server', 'None'])

export const pointsToSVG = (points) => points.map(({ x, y }) => `${x} ${y}`).join(' ')

const memoEq = (fn) => (input) => useMemoEq(input, fn)

export const usePaint = memoEq(
  R.pipe(
    (paint) => {
      if (Paint.is(paint)) {
        const id = uuid.v1()
        return (fn) => fn(paint, id)
      }
      // assuming object if not array
      const map = Array.isArray(paint) ? R.addIndex(R.map) : R.mapObjIndexed
      const ids = map(() => uuid.v1(), paint)
      return (fn) => map((p, k) => fn(p, ids[k]), paint)
    },
    (map) =>
      map(
        Paint.case({
          Color: (value) => ({ ref: value, def: null }),
          Server: (el, id) => ({
            ref: `url(#${id})`,
            def: React.cloneElement(el, { id, key: id }),
          }),
          None: () => ({ ref: 'none', def: null }),
        }),
      ),
  ),
)
