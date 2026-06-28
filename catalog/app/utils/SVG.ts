import * as R from 'ramda'
import * as React from 'react'
import * as uuid from 'uuid'

import tagged from 'utils/tagged'
import useMemoEq from 'utils/useMemoEq'

export const Paint = tagged(['Color', 'Server', 'None'])

interface Point {
  x: number
  y: number
}

export const pointsToSVG = (points: Point[]) =>
  points.map(({ x, y }) => `${x} ${y}`).join(' ')

// A resolved paint: a reference usable in SVG attributes (fill/stroke) plus an
// optional element to mount under <defs>. `usePaint` returns one of these for a
// single Paint, or a map (array/object) of these mirroring its input.
interface ResolvedPaint {
  ref: string
  def: React.ReactElement | null
}

const memoEq =
  <I, O>(fn: (input: I) => O) =>
  (input: I) =>
    useMemoEq(input, fn)

export const usePaint: (paint: any) => any = memoEq(
  R.pipe(
    (paint: any) => {
      if (Paint.is(paint)) {
        const id = uuid.v1()
        return (fn: (p: any, id?: string) => any) => fn(paint, id)
      }
      // assuming object if not array
      const map = Array.isArray(paint) ? R.addIndex(R.map) : R.mapObjIndexed
      const ids = map(() => uuid.v1(), paint)
      return (fn: (p: any, id?: string) => any) =>
        map((p: any, k: any) => fn(p, (ids as any)[k]), paint)
    },
    (map) =>
      map(
        Paint.case({
          Color: (value: string): ResolvedPaint => ({ ref: value, def: null }),
          Server: (el: React.ReactElement, id: string): ResolvedPaint => ({
            ref: `url(#${id})`,
            def: React.cloneElement(el, { id, key: id }),
          }),
          None: (): ResolvedPaint => ({ ref: 'none', def: null }),
        }),
      ),
  ),
)
