import * as R from 'ramda'

export const isNullable = (type) => R.either(R.isNil, R.is(type))
export const isArrayOf = (pred) => R.both(R.is(Array), R.all(pred))

// TODO: collect errors for helpful error message
export const conforms = R.pipe(
  R.toPairs,
  R.map(([k, pred]) => R.propSatisfies(pred, k)),
  R.allPass,
)
