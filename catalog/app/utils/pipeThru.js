import * as R from 'ramda'

/** @deprecated Use pipe from fp-ts */
export default (...args) =>
  (...fns) =>
    R.pipe(...fns)(...args)
