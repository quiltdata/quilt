import * as R from 'ramda'

export default (...args) => (...fns) => R.pipe(...fns)(...args)
