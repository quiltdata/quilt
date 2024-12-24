import * as qs from 'querystring'

import * as R from 'ramda'

export default R.pipe(
  R.reject(R.isNil),
  qs.stringify,
  R.unless(R.isEmpty, R.concat('?')),
) as (params: qs.ParsedUrlQueryInput) => string
