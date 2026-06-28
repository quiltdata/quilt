import * as R from 'ramda'

import tagged from 'utils/tagged'

const AsyncResult = tagged(['Init', 'Pending', 'Ok', 'Err'])

AsyncResult.prop = (name: string, ...args: any[]) =>
  AsyncResult.mapCase({ Ok: R.prop(name) }, ...args)

AsyncResult.props = R.curryN(2, (names: string[], ...args: any[]) =>
  names.reduce(
    (acc, name) => ({
      ...acc,
      [name]: AsyncResult.prop(name, ...args),
    }),
    {},
  ),
)

AsyncResult.getPrevResult = AsyncResult.case({
  Ok: R.identity,
  Pending: (p: unknown) => AsyncResult.getPrevResult(p),
  _: () => null,
})

export default AsyncResult
