import * as R from 'ramda'

import tagged from 'utils/tagged'

const AsyncResult = tagged(['Init', 'Pending', 'Ok', 'Err'])

AsyncResult.prop = (name, ...args) => AsyncResult.mapCase({ Ok: R.prop(name) }, ...args)

AsyncResult.props = R.curryN(2, (names, ...args) =>
  names.reduce(
    (acc, name) => ({
      ...acc,
      [name]: AsyncResult.prop(name, ...args),
    }),
    {},
  ),
)

export default AsyncResult
