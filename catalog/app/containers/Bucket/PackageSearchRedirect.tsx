import invariant from 'invariant'
import * as React from 'react'
import * as RR from 'react-router-dom'
import * as S from '@effect/schema/Schema'
// import * as M from '@material-ui/core'

import SearchRoute from 'containers/Search/Route'
import * as SearchModel from 'containers/Search/model'

// params -> location
const encode = S.encodeSync(SearchRoute.paramsSchema)

export default function PackageSearchRedirect() {
  const { bucket } = RR.useParams<{ bucket: string }>()
  invariant(!!bucket, '`bucket` must be defined')

  // get the workflows config
  // redirect to search with the following params:
  // - current bucket selected
  // - mode: packages
  // - sort: latest
  // - default workflow selected if configured
  // respect route params? (filter, sort, p(age))

  const loc = React.useMemo(
    () =>
      encode({
        buckets: [bucket],
        order: SearchModel.ResultOrder.NEWEST,
        params: {
          resultType: SearchModel.ResultType.QuiltPackage,
        },
      }),
    [bucket],
  )
  return <RR.Redirect to={loc}>go to search</RR.Redirect>
}
