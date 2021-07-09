import * as R from 'ramda'

// TODO: deprecate, use pipe from fp-ts
export default (...args) => (...fns) => R.pipe(...fns)(...args)
