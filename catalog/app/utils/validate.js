import * as R from 'ramda'

import logger from 'utils/logger'

export const isNullable = (pred) => R.either(R.isNil, pred)

export const isArrayOf = (pred) => R.both(R.is(Array), R.all(pred))

export const isNonEmptyArrayOf = (pred) =>
  R.both(R.complement(R.isEmpty), isArrayOf(pred))

export const oneOf = R.flip(R.includes)

export const conforms = R.pipe(
  R.toPairs,
  R.map(([k, pred]) =>
    R.unless(R.propSatisfies(pred, k), (obj) => {
      logger.warn(`Key '${k}' has invalid value '${JSON.stringify(obj[k])}'`)
      return false
    }),
  ),
  R.allPass,
)
